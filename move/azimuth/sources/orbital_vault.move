/// OrbitalVault — Azimuth DePIN reward engine on Sui.
///
/// Port of the Hedera Solidity `OrbitalVault.sol`. Manages:
///   - Station registration + AZM staking
///   - PoA (Proof of Availability): heartbeats + per-epoch rewards
///   - PoRx (Proof of Reception): packet proofs, cross-station verification, payout
///   - Merged-image records anchored to Walrus blobs + availability certificates
///
/// Hedera → Sui translations:
///   - HTS token            → `Coin<AZM>` reward pool (`azimuth::azm`)
///   - HCS coordination     → on-chain Move events
///   - block.timestamp      → `sui::clock::Clock`
///   - Hedera Schedule Svc  → permissionless `settle_poa_epoch` crank + unstake cooldown
///   - nested mappings       → Sui objects (`PoRxProof`, `ImageCapture`) + `Table`
module azimuth::orbital_vault {
    use std::string::String;
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};
    use sui::event;
    use azimuth::azm::AZM;

    // ── Errors ────────────────────────────────────────────────────────────────
    const EAlreadyRegistered: u64 = 1;
    const ENotRegistered: u64 = 2;
    const ENotActive: u64 = 3;
    const EEpochNotReady: u64 = 4;
    const EBadCount: u64 = 6;
    const ECannotSelfVerify: u64 = 7;
    const EAlreadyVerified: u64 = 9;
    const EAlreadyPaid: u64 = 11;
    const ECooldown: u64 = 12;
    const ENoUnstake: u64 = 13;
    const EAlreadyRecorded: u64 = 14;
    const EInsufficientStake: u64 = 15;
    const EWrongRegistry: u64 = 16;

    // ── Capabilities ──────────────────────────────────────────────────────────
    /// Admin capability minted to the deployer. Gates owner-only actions.
    public struct AdminCap has key, store { id: UID }

    // ── Core objects ──────────────────────────────────────────────────────────
    public struct Station has store {
        active: bool,
        location: String,
        staked: Balance<AZM>,
        staked_at_ms: u64,
        last_heartbeat_ms: u64,
        heartbeat_count: u64,
        total_poa_rewards: u64,
        total_porx_rewards: u64,
        unstake_requested_at_ms: u64, // 0 = no pending unstake
    }

    public struct StationRegistry has key {
        id: UID,
        reward_pool: Balance<AZM>,
        stations: Table<address, Station>,
        station_list: vector<address>,
        images: Table<vector<u8>, ID>, // passId -> ImageCapture id (dedupe + lookup)
        // params
        poa_epoch_interval_ms: u64,
        poa_reward_amount: u64,
        porx_base_reward: u64,
        stake_amount: u64,
        unstake_cooldown_ms: u64,
        heartbeat_threshold: u64,
        // epoch state
        poa_epoch_count: u64,
        poa_epoch_start_ms: u64,
        porx_proof_count: u64,
    }

    /// Proof of Reception. Shared so a second station can verify it.
    public struct PoRxProof has key, store {
        id: UID,
        registry: ID,
        station: address,
        pass_id: vector<u8>,
        packet_count: u16,
        total_packets: u16,
        packet_merkle: vector<u8>,
        avg_rssi: u16,
        avg_snr: u16,
        walrus_blob_id: String, // Walrus blob holding this station's raw packets
        reward_amount: u64,
        verified: bool,
        paid: bool,
        submitted_at_ms: u64,
    }

    /// Final merged satellite image, anchored to a Walrus blob + its on-chain
    /// availability certificate. Proof-of-reception backed by proof-of-availability.
    public struct ImageCapture has key, store {
        id: UID,
        registry: ID,
        pass_id: vector<u8>,
        walrus_blob_id: String,   // content-addressed Walrus blob id
        blob_object_id: String,   // on-chain Walrus `Blob` object id (hex)
        certified_epoch: u64,     // Walrus epoch the blob was certified available
        recovered: u16,
        total: u16,
        high_value: bool,
        submitter: address,
    }

    // ── Events (replace Hedera HCS coordination) ────────────────────────────────
    public struct StationRegistered has copy, drop { station: address, location: String }
    public struct HeartbeatEmitted has copy, drop { station: address, timestamp_ms: u64, count: u64 }
    public struct PoAEpochSettled has copy, drop { epoch: u64, available: u64, total_rewarded: u64 }
    public struct PoAReward has copy, drop { station: address, epoch: u64, amount: u64 }
    public struct PoRxSubmitted has copy, drop { station: address, pass_id: vector<u8>, proof_id: ID, packet_count: u16, walrus_blob_id: String }
    public struct PoRxVerified has copy, drop { station: address, pass_id: vector<u8>, verifier: address, amount: u64 }
    public struct StationDeactivated has copy, drop { station: address, unlock_at_ms: u64 }
    public struct Unstaked has copy, drop { station: address, amount: u64 }
    public struct Slashed has copy, drop { station: address, amount: u64 }
    public struct ImageMerged has copy, drop { pass_id: vector<u8>, walrus_blob_id: String, capture_id: ID, submitter: address, recovered: u16, total: u16 }

    // ── Init ────────────────────────────────────────────────────────────────────
    fun init(ctx: &mut TxContext) {
        let registry = StationRegistry {
            id: object::new(ctx),
            reward_pool: balance::zero<AZM>(),
            stations: table::new(ctx),
            station_list: vector::empty(),
            images: table::new(ctx),
            poa_epoch_interval_ms: 6 * 60 * 60 * 1000, // 6 hours
            poa_reward_amount: 2,
            porx_base_reward: 1,
            stake_amount: 100,
            unstake_cooldown_ms: 7 * 24 * 60 * 60 * 1000, // 7 days
            heartbeat_threshold: 1,
            poa_epoch_count: 0,
            poa_epoch_start_ms: 0,
            porx_proof_count: 0,
        };
        transfer::share_object(registry);
        transfer::public_transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
    }

    // ── Funding ─────────────────────────────────────────────────────────────────
    /// Deposit AZM into the reward pool (anyone can top it up).
    public entry fun fund(reg: &mut StationRegistry, payment: Coin<AZM>) {
        balance::join(&mut reg.reward_pool, coin::into_balance(payment));
    }

    /// Begin the PoA epoch clock. Idempotent-ish: callable once at genesis.
    public entry fun start_poa(reg: &mut StationRegistry, clock: &Clock, _admin: &AdminCap) {
        reg.poa_epoch_start_ms = clock::timestamp_ms(clock);
    }

    // ── Registration & staking ──────────────────────────────────────────────────
    public entry fun register_station(
        reg: &mut StationRegistry,
        stake: Coin<AZM>,
        location: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let who = ctx.sender();
        assert!(!table::contains(&reg.stations, who), EAlreadyRegistered);
        assert!(coin::value(&stake) >= reg.stake_amount, EInsufficientStake);

        let station = Station {
            active: true,
            location,
            staked: coin::into_balance(stake),
            staked_at_ms: clock::timestamp_ms(clock),
            last_heartbeat_ms: 0,
            heartbeat_count: 0,
            total_poa_rewards: 0,
            total_porx_rewards: 0,
            unstake_requested_at_ms: 0,
        };
        table::add(&mut reg.stations, who, station);
        vector::push_back(&mut reg.station_list, who);
        event::emit(StationRegistered { station: who, location });
    }

    // ── PoA: heartbeats + epoch settlement ──────────────────────────────────────
    public entry fun heartbeat(reg: &mut StationRegistry, clock: &Clock, ctx: &mut TxContext) {
        let who = ctx.sender();
        assert!(table::contains(&reg.stations, who), ENotRegistered);
        let s = table::borrow_mut(&mut reg.stations, who);
        assert!(s.active, ENotActive);
        s.last_heartbeat_ms = clock::timestamp_ms(clock);
        s.heartbeat_count = s.heartbeat_count + 1;
        event::emit(HeartbeatEmitted { station: who, timestamp_ms: s.last_heartbeat_ms, count: s.heartbeat_count });
    }

    /// Permissionless crank. Replaces Hedera Schedule Service: anyone may settle
    /// the epoch once the interval has elapsed. The sui-client runs this on a timer.
    public entry fun settle_poa_epoch(reg: &mut StationRegistry, clock: &Clock, ctx: &mut TxContext) {
        let now = clock::timestamp_ms(clock);
        assert!(now >= reg.poa_epoch_start_ms + reg.poa_epoch_interval_ms, EEpochNotReady);

        reg.poa_epoch_count = reg.poa_epoch_count + 1;
        let epoch = reg.poa_epoch_count;
        let reward = reg.poa_reward_amount;
        let threshold = reg.heartbeat_threshold;

        let mut rewarded = 0u64;
        let mut available = 0u64;
        let n = vector::length(&reg.station_list);
        let mut i = 0;
        while (i < n) {
            let addr = *vector::borrow(&reg.station_list, i);
            // Decide eligibility behind a short immutable borrow (released before paying).
            let qualifies = {
                let s = table::borrow(&reg.stations, addr);
                s.active && s.heartbeat_count >= threshold
            };
            if (qualifies && balance::value(&reg.reward_pool) >= reward) {
                let c = coin::take(&mut reg.reward_pool, reward, ctx);
                transfer::public_transfer(c, addr);
                let s = table::borrow_mut(&mut reg.stations, addr);
                s.total_poa_rewards = s.total_poa_rewards + reward;
                rewarded = rewarded + reward;
                available = available + 1;
                event::emit(PoAReward { station: addr, epoch, amount: reward });
            };
            // Reset the heartbeat counter for the next epoch.
            let s = table::borrow_mut(&mut reg.stations, addr);
            s.heartbeat_count = 0;
            i = i + 1;
        };

        reg.poa_epoch_start_ms = now;
        event::emit(PoAEpochSettled { epoch, available, total_rewarded: rewarded });
    }

    // ── PoRx: submit + verify + pay ─────────────────────────────────────────────
    public entry fun submit_porx(
        reg: &mut StationRegistry,
        pass_id: vector<u8>,
        packet_count: u16,
        total_packets: u16,
        packet_merkle: vector<u8>,
        avg_rssi: u16,
        avg_snr: u16,
        walrus_blob_id: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let who = ctx.sender();
        assert!(table::contains(&reg.stations, who), ENotRegistered);
        assert!(table::borrow(&reg.stations, who).active, ENotActive);
        assert!(packet_count > 0 && packet_count <= total_packets, EBadCount);

        let reward = (packet_count as u64) * reg.porx_base_reward;
        let proof = PoRxProof {
            id: object::new(ctx),
            registry: object::id(reg),
            station: who,
            pass_id,
            packet_count,
            total_packets,
            packet_merkle,
            avg_rssi,
            avg_snr,
            walrus_blob_id,
            reward_amount: reward,
            verified: false,
            paid: false,
            submitted_at_ms: clock::timestamp_ms(clock),
        };
        reg.porx_proof_count = reg.porx_proof_count + 1;
        let proof_id = object::id(&proof);
        event::emit(PoRxSubmitted { station: who, pass_id, proof_id, packet_count, walrus_blob_id });
        transfer::share_object(proof);
    }

    /// A different active station verifies the proof; on success the reward is paid
    /// immediately from the pool (claim + verify + pay collapsed — no scheduler on Sui).
    public entry fun verify_porx(
        reg: &mut StationRegistry,
        proof: &mut PoRxProof,
        ctx: &mut TxContext,
    ) {
        assert!(proof.registry == object::id(reg), EWrongRegistry);
        let verifier = ctx.sender();
        assert!(verifier != proof.station, ECannotSelfVerify);
        assert!(table::contains(&reg.stations, verifier), ENotRegistered);
        assert!(table::borrow(&reg.stations, verifier).active, ENotActive);
        assert!(!proof.verified, EAlreadyVerified);
        assert!(!proof.paid, EAlreadyPaid);

        proof.verified = true;

        if (balance::value(&reg.reward_pool) >= proof.reward_amount) {
            let c = coin::take(&mut reg.reward_pool, proof.reward_amount, ctx);
            transfer::public_transfer(c, proof.station);
            proof.paid = true;
            let s = table::borrow_mut(&mut reg.stations, proof.station);
            s.total_porx_rewards = s.total_porx_rewards + proof.reward_amount;
        };
        event::emit(PoRxVerified { station: proof.station, pass_id: proof.pass_id, verifier, amount: proof.reward_amount });
    }

    // ── Image record (Walrus anchor) ────────────────────────────────────────────
    public entry fun record_image(
        reg: &mut StationRegistry,
        pass_id: vector<u8>,
        walrus_blob_id: String,
        blob_object_id: String,
        certified_epoch: u64,
        recovered: u16,
        total: u16,
        high_value: bool,
        ctx: &mut TxContext,
    ) {
        let who = ctx.sender();
        assert!(table::contains(&reg.stations, who), ENotRegistered);
        assert!(table::borrow(&reg.stations, who).active, ENotActive);
        assert!(!table::contains(&reg.images, pass_id), EAlreadyRecorded);

        let cap = ImageCapture {
            id: object::new(ctx),
            registry: object::id(reg),
            pass_id,
            walrus_blob_id,
            blob_object_id,
            certified_epoch,
            recovered,
            total,
            high_value,
            submitter: who,
        };
        let cap_id = object::id(&cap);
        table::add(&mut reg.images, pass_id, cap_id);
        event::emit(ImageMerged { pass_id, walrus_blob_id, capture_id: cap_id, submitter: who, recovered, total });
        transfer::share_object(cap);
    }

    // ── Unstake (cooldown replaces Hedera Schedule Service timed call) ───────────
    public entry fun request_unstake(reg: &mut StationRegistry, clock: &Clock, ctx: &mut TxContext) {
        let who = ctx.sender();
        assert!(table::contains(&reg.stations, who), ENotRegistered);
        let cooldown = reg.unstake_cooldown_ms;
        let s = table::borrow_mut(&mut reg.stations, who);
        assert!(s.active, ENotActive);
        s.active = false;
        s.unstake_requested_at_ms = clock::timestamp_ms(clock);
        event::emit(StationDeactivated { station: who, unlock_at_ms: s.unstake_requested_at_ms + cooldown });
    }

    public entry fun cancel_unstake(reg: &mut StationRegistry, ctx: &mut TxContext) {
        let who = ctx.sender();
        assert!(table::contains(&reg.stations, who), ENotRegistered);
        let s = table::borrow_mut(&mut reg.stations, who);
        assert!(s.unstake_requested_at_ms != 0, ENoUnstake);
        s.active = true;
        s.unstake_requested_at_ms = 0;
    }

    public entry fun complete_unstake(reg: &mut StationRegistry, clock: &Clock, ctx: &mut TxContext) {
        let who = ctx.sender();
        assert!(table::contains(&reg.stations, who), ENotRegistered);
        let cooldown = reg.unstake_cooldown_ms;
        {
            let s = table::borrow(&reg.stations, who);
            assert!(s.unstake_requested_at_ms != 0, ENoUnstake);
            assert!(clock::timestamp_ms(clock) >= s.unstake_requested_at_ms + cooldown, ECooldown);
        };
        let Station {
            active: _, location: _, staked, staked_at_ms: _, last_heartbeat_ms: _,
            heartbeat_count: _, total_poa_rewards: _, total_porx_rewards: _, unstake_requested_at_ms: _,
        } = table::remove(&mut reg.stations, who);
        remove_from_list(&mut reg.station_list, who);
        let amount = balance::value(&staked);
        transfer::public_transfer(coin::from_balance(staked, ctx), who);
        event::emit(Unstaked { station: who, amount });
    }

    // ── Admin ───────────────────────────────────────────────────────────────────
    public entry fun slash(reg: &mut StationRegistry, station_addr: address, _admin: &AdminCap, ctx: &mut TxContext) {
        assert!(table::contains(&reg.stations, station_addr), ENotRegistered);
        let s = table::borrow_mut(&mut reg.stations, station_addr);
        s.active = false;
        let penalty = balance::value(&s.staked) / 2;
        if (penalty > 0) {
            let slashed = balance::split(&mut s.staked, penalty);
            balance::join(&mut reg.reward_pool, slashed); // penalty returns to the pool
        };
        event::emit(Slashed { station: station_addr, amount: penalty });
    }

    public entry fun set_epoch_interval(reg: &mut StationRegistry, interval_ms: u64, _admin: &AdminCap) {
        reg.poa_epoch_interval_ms = interval_ms;
    }

    public entry fun set_reward_rates(reg: &mut StationRegistry, poa_reward: u64, porx_base: u64, _admin: &AdminCap) {
        reg.poa_reward_amount = poa_reward;
        reg.porx_base_reward = porx_base;
    }

    public entry fun set_heartbeat_threshold(reg: &mut StationRegistry, threshold: u64, _admin: &AdminCap) {
        reg.heartbeat_threshold = threshold;
    }

    public entry fun set_stake_amount(reg: &mut StationRegistry, amount: u64, _admin: &AdminCap) {
        reg.stake_amount = amount;
    }

    public entry fun set_unstake_cooldown(reg: &mut StationRegistry, cooldown_ms: u64, _admin: &AdminCap) {
        reg.unstake_cooldown_ms = cooldown_ms;
    }

    // ── Internal ──────────────────────────────────────────────────────────────────
    fun remove_from_list(list: &mut vector<address>, who: address) {
        let n = vector::length(list);
        let mut i = 0;
        while (i < n) {
            if (*vector::borrow(list, i) == who) {
                vector::swap_remove(list, i);
                return
            };
            i = i + 1;
        };
    }

    // ── Read-only accessors (used by tests; clients read object fields via RPC) ──
    public fun station_count(reg: &StationRegistry): u64 { vector::length(&reg.station_list) }
    public fun reward_pool_value(reg: &StationRegistry): u64 { balance::value(&reg.reward_pool) }
    public fun epoch_count(reg: &StationRegistry): u64 { reg.poa_epoch_count }
    public fun is_registered(reg: &StationRegistry, who: address): bool { table::contains(&reg.stations, who) }
    public fun is_active(reg: &StationRegistry, who: address): bool {
        table::contains(&reg.stations, who) && table::borrow(&reg.stations, who).active
    }
    public fun heartbeat_count(reg: &StationRegistry, who: address): u64 { table::borrow(&reg.stations, who).heartbeat_count }
    public fun total_poa_rewards(reg: &StationRegistry, who: address): u64 { table::borrow(&reg.stations, who).total_poa_rewards }
    public fun total_porx_rewards(reg: &StationRegistry, who: address): u64 { table::borrow(&reg.stations, who).total_porx_rewards }
    public fun proof_paid(p: &PoRxProof): bool { p.paid }
    public fun proof_verified(p: &PoRxProof): bool { p.verified }
    public fun proof_reward(p: &PoRxProof): u64 { p.reward_amount }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) { init(ctx) }
}
