#[test_only]
module azimuth::orbital_vault_tests {
    use std::string;
    use sui::test_scenario::{Self as ts};
    use sui::clock::{Self, Clock};
    use sui::coin::{Coin, TreasuryCap};
    use azimuth::azm::{Self, AZM};
    use azimuth::orbital_vault::{Self as ov, StationRegistry, AdminCap, PoRxProof};

    const OWNER: address = @0xA1;
    const STA: address = @0xB1;
    const STB: address = @0xB2;

    const SIX_HOURS_MS: u64 = 6 * 60 * 60 * 1000;

    #[test]
    fun full_reward_loop() {
        let mut sc = ts::begin(OWNER);

        // Tx1: publish coin + vault
        {
            let ctx = ts::ctx(&mut sc);
            azm::init_for_testing(ctx);
            ov::init_for_testing(ctx);
        };

        // Tx2: fund pool, distribute stake, start epoch clock
        ts::next_tx(&mut sc, OWNER);
        {
            let mut reg = ts::take_shared<StationRegistry>(&sc);
            let mut treasury = ts::take_from_sender<TreasuryCap<AZM>>(&sc);
            let admin = ts::take_from_sender<AdminCap>(&sc);

            let pool = azm::test_mint(&mut treasury, 1_000_000, ts::ctx(&mut sc));
            ov::fund(&mut reg, pool);

            let stake_a = azm::test_mint(&mut treasury, 200, ts::ctx(&mut sc));
            transfer::public_transfer(stake_a, STA);
            let stake_b = azm::test_mint(&mut treasury, 200, ts::ctx(&mut sc));
            transfer::public_transfer(stake_b, STB);

            let clock = clock::create_for_testing(ts::ctx(&mut sc));
            ov::start_poa(&mut reg, &clock, &admin);
            clock::share_for_testing(clock);

            ts::return_to_sender(&sc, treasury);
            ts::return_to_sender(&sc, admin);
            ts::return_shared(reg);
        };

        // Tx3 + Tx4: register two stations
        register(&mut sc, STA, b"NYC");
        register(&mut sc, STB, b"MOON");
        assert!(true, 0);

        // Tx5 + Tx6: each station heartbeats
        beat(&mut sc, STA);
        beat(&mut sc, STB);

        // Tx7: advance past the interval and settle the epoch (permissionless crank)
        ts::next_tx(&mut sc, OWNER);
        {
            let mut reg = ts::take_shared<StationRegistry>(&sc);
            let mut clk = ts::take_shared<Clock>(&sc);
            clock::increment_for_testing(&mut clk, SIX_HOURS_MS + 1);
            ov::settle_poa_epoch(&mut reg, &clk, ts::ctx(&mut sc));
            assert!(ov::epoch_count(&reg) == 1, 1);
            assert!(ov::total_poa_rewards(&reg, STA) == 2, 2);
            assert!(ov::total_poa_rewards(&reg, STB) == 2, 3);
            ts::return_shared(reg);
            ts::return_shared(clk);
        };

        // Tx8: STA submits a PoRx proof
        ts::next_tx(&mut sc, STA);
        {
            let mut reg = ts::take_shared<StationRegistry>(&sc);
            let clk = ts::take_shared<Clock>(&sc);
            ov::submit_porx(
                &mut reg, b"pass-1", 5, 10, b"merkle", 100, 50,
                string::utf8(b"blobA"), &clk, ts::ctx(&mut sc),
            );
            ts::return_shared(reg);
            ts::return_shared(clk);
        };

        // Tx9: STB verifies → reward paid
        ts::next_tx(&mut sc, STB);
        {
            let mut reg = ts::take_shared<StationRegistry>(&sc);
            let mut proof = ts::take_shared<PoRxProof>(&sc);
            ov::verify_porx(&mut reg, &mut proof, ts::ctx(&mut sc));
            assert!(ov::proof_verified(&proof), 4);
            assert!(ov::proof_paid(&proof), 5);
            assert!(ov::total_porx_rewards(&reg, STA) == 5, 6); // 5 packets * base 1
            ts::return_shared(reg);
            ts::return_shared(proof);
        };

        ts::end(sc);
    }

    #[test]
    #[expected_failure]
    fun cannot_settle_early() {
        let mut sc = ts::begin(OWNER);
        {
            let ctx = ts::ctx(&mut sc);
            azm::init_for_testing(ctx);
            ov::init_for_testing(ctx);
        };
        ts::next_tx(&mut sc, OWNER);
        {
            let mut reg = ts::take_shared<StationRegistry>(&sc);
            let admin = ts::take_from_sender<AdminCap>(&sc);
            let clock = clock::create_for_testing(ts::ctx(&mut sc));
            ov::start_poa(&mut reg, &clock, &admin);
            ov::settle_poa_epoch(&mut reg, &clock, ts::ctx(&mut sc)); // too early → abort
            clock::destroy_for_testing(clock);
            ts::return_to_sender(&sc, admin);
            ts::return_shared(reg);
        };
        ts::end(sc);
    }

    // ── helpers ───────────────────────────────────────────────────────────────
    fun register(sc: &mut ts::Scenario, who: address, location: vector<u8>) {
        ts::next_tx(sc, who);
        let mut reg = ts::take_shared<StationRegistry>(sc);
        let clk = ts::take_shared<Clock>(sc);
        let stake = ts::take_from_sender<Coin<AZM>>(sc);
        ov::register_station(&mut reg, stake, string::utf8(location), &clk, ts::ctx(sc));
        ts::return_shared(reg);
        ts::return_shared(clk);
    }

    fun beat(sc: &mut ts::Scenario, who: address) {
        ts::next_tx(sc, who);
        let mut reg = ts::take_shared<StationRegistry>(sc);
        let clk = ts::take_shared<Clock>(sc);
        ov::heartbeat(&mut reg, &clk, ts::ctx(sc));
        ts::return_shared(reg);
        ts::return_shared(clk);
    }
}
