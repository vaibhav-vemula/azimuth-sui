/// Seal access control for premium (full-resolution / raw) satellite captures.
///
/// Free tier: a low-res merged JPEG is stored on Walrus in the clear.
/// Premium tier: the full-res capture + raw packets are encrypted client-side with
/// Seal against this policy. Decryption is only released when `seal_approve` passes:
/// the caller must be the capturing station/owner, or have bought access for that pass.
///
/// Seal calls the `seal_approve*` entry function off-chain (dry-run) with the
/// encryption identity bytes; it must abort when access is denied.
module azimuth::access_policy {
    use std::string::String;
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::table::{Self, Table};
    use sui::event;

    const ENoAccess: u64 = 0;
    const EInsufficientPayment: u64 = 1;

    public struct PolicyAdminCap has key, store { id: UID }

    public struct AccessRegistry has key {
        id: UID,
        owner: address,
        price_mist: u64,                       // price per pass, in MIST (1 SUI = 1e9)
        treasury: Balance<SUI>,                // accumulated sales
        buyers: Table<vector<u8>, vector<address>>, // passId -> buyers
    }

    public struct AccessGranted has copy, drop { pass_id: vector<u8>, buyer: address, blob_id: String }
    public struct PriceUpdated has copy, drop { price_mist: u64 }

    fun init(ctx: &mut TxContext) {
        let reg = AccessRegistry {
            id: object::new(ctx),
            owner: ctx.sender(),
            price_mist: 100_000_000, // 0.1 SUI default
            treasury: balance::zero<SUI>(),
            buyers: table::new(ctx),
        };
        transfer::share_object(reg);
        transfer::public_transfer(PolicyAdminCap { id: object::new(ctx) }, ctx.sender());
    }

    /// Buy decryption access to a pass's premium capture.
    public entry fun buy_access(
        reg: &mut AccessRegistry,
        pass_id: vector<u8>,
        blob_id: String,
        mut payment: Coin<SUI>,
        ctx: &mut TxContext,
    ) {
        assert!(coin::value(&payment) >= reg.price_mist, EInsufficientPayment);
        // Take exactly the price; refund any excess.
        let due = coin::split(&mut payment, reg.price_mist, ctx);
        balance::join(&mut reg.treasury, coin::into_balance(due));
        let buyer = ctx.sender();
        if (coin::value(&payment) > 0) {
            transfer::public_transfer(payment, buyer);
        } else {
            coin::destroy_zero(payment);
        };

        if (!table::contains(&reg.buyers, pass_id)) {
            table::add(&mut reg.buyers, pass_id, vector::empty<address>());
        };
        let list = table::borrow_mut(&mut reg.buyers, pass_id);
        if (!vector::contains(list, &buyer)) {
            vector::push_back(list, buyer);
        };
        event::emit(AccessGranted { pass_id, buyer, blob_id });
    }

    /// Seal entry: aborts unless the caller may decrypt `id`.
    /// `id` is the Seal identity = the pass_id bytes used at encryption time.
    entry fun seal_approve(id: vector<u8>, reg: &AccessRegistry, ctx: &TxContext) {
        assert!(has_access(reg, id, ctx.sender()), ENoAccess);
    }

    public fun has_access(reg: &AccessRegistry, pass_id: vector<u8>, who: address): bool {
        if (who == reg.owner) return true;
        if (!table::contains(&reg.buyers, pass_id)) return false;
        vector::contains(table::borrow(&reg.buyers, pass_id), &who)
    }

    // ── Admin ────────────────────────────────────────────────────────────────────
    public entry fun set_price(reg: &mut AccessRegistry, price_mist: u64, _admin: &PolicyAdminCap) {
        reg.price_mist = price_mist;
        event::emit(PriceUpdated { price_mist });
    }

    public entry fun withdraw(reg: &mut AccessRegistry, _admin: &PolicyAdminCap, ctx: &mut TxContext) {
        let amount = balance::value(&reg.treasury);
        if (amount > 0) {
            let c = coin::take(&mut reg.treasury, amount, ctx);
            transfer::public_transfer(c, reg.owner);
        }
    }

    public fun price(reg: &AccessRegistry): u64 { reg.price_mist }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) { init(ctx) }
}
