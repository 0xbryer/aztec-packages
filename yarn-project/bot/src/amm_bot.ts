import { Fr, SentTx, type Wallet } from '@aztec/aztec.js';
import type { AMMContract } from '@aztec/noir-contracts.js/AMM';
import type { TokenContract } from '@aztec/noir-contracts.js/Token';
import type { AztecNode, AztecNodeAdmin, PXE } from '@aztec/stdlib/interfaces/client';

import { BaseBot } from './base_bot.js';
import type { BotConfig } from './config.js';
import { BotFactory } from './factory.js';

const TRANSFER_AMOUNT = 1;

export class AmmBot extends BaseBot {
  protected constructor(
    pxe: PXE,
    wallet: Wallet,
    public readonly amm: AMMContract,
    public readonly token0: TokenContract,
    public readonly token1: TokenContract,
    config: BotConfig,
  ) {
    super(pxe, wallet, config);
  }

  static async create(
    config: BotConfig,
    dependencies: { pxe?: PXE; node?: AztecNode; nodeAdmin?: AztecNodeAdmin },
  ): Promise<AmmBot> {
    const { pxe, wallet, token0, token1, amm } = await new BotFactory(config, dependencies).setupAmm();
    return new AmmBot(pxe, wallet, amm, token0, token1, config);
  }

  protected async createAndSendTx(logCtx: object): Promise<SentTx> {
    const { feePaymentMethod } = this.config;
    const { wallet, amm, token0, token1 } = this;

    this.log.verbose(`Preparing tx with ${feePaymentMethod} fee to swap tokens`, logCtx);

    const ammBalances = await this.getAmmBalances();
    const amountIn = TRANSFER_AMOUNT;
    const nonce = Fr.random();

    const swapAuthwit = await wallet.createAuthWit({
      caller: amm.address,
      action: token0.methods.transfer_to_public(wallet.getAddress(), amm.address, amountIn, nonce),
    });

    const amountOutMin = await amm.methods
      .get_amount_out_for_exact_in(ammBalances.token0, ammBalances.token1, amountIn)
      .simulate();

    const swapExactTokensInteraction = amm.methods.swap_exact_tokens_for_tokens(
      token0.address,
      token1.address,
      amountIn,
      amountOutMin,
      nonce,
    );

    const opts = this.getSendMethodOpts(swapAuthwit);
    this.log.verbose(`Simulating swap transaction`, logCtx);
    await swapExactTokensInteraction.simulate(opts);

    this.log.verbose(`Proving transaction`, logCtx);
    const tx = await swapExactTokensInteraction.prove(opts);
    return tx.send();
  }

  async getAmmBalances(): Promise<{ token0: bigint; token1: bigint }> {
    return {
      token0: await this.token0.methods.balance_of_public(this.amm.address).simulate(),
      token1: await this.token1.methods.balance_of_public(this.amm.address).simulate(),
    };
  }
}
