/// AZM — Azimuth ground-station reward token.
///
/// Replaces the Hedera HTS token. A standard Sui `Coin<AZM>` created via
/// `coin::create_currency`. The deployer receives the `TreasuryCap` and mints
/// the initial supply, then funds `orbital_vault::StationRegistry`'s reward pool.
module azimuth::azm {
    use sui::coin::{Self, TreasuryCap};

    /// One-time witness for the AZM currency.
    public struct AZM has drop {}

    /// 8 decimals to match the dashboard credit-score math (1 AZM = 1e8 base units).
    const DECIMALS: u8 = 8;

    fun init(witness: AZM, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            DECIMALS,
            b"AZM",
            b"Azimuth",
            b"Azimuth ground-station reward token",
            option::none(),
            ctx,
        );
        // Metadata is immutable once published.
        transfer::public_freeze_object(metadata);
        // Deployer holds the treasury to mint the reward supply.
        transfer::public_transfer(treasury, ctx.sender());
    }

    /// Mint `amount` base units of AZM to `recipient`. Owner-gated by holding the cap.
    public entry fun mint(
        treasury: &mut TreasuryCap<AZM>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        let c = coin::mint(treasury, amount, ctx);
        transfer::public_transfer(c, recipient);
    }

    #[test_only]
    public fun test_mint(treasury: &mut TreasuryCap<AZM>, amount: u64, ctx: &mut TxContext): sui::coin::Coin<AZM> {
        coin::mint(treasury, amount, ctx)
    }

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(AZM {}, ctx)
    }
}
