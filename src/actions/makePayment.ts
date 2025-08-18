import { defineAction } from 'astro:actions';
import { getSecret } from "astro:env/server";
import { z } from "astro:schema";
import * as chains from '@circle-fin/usdckit/chains';
import { createCircleClient } from '@circle-fin/usdckit';

export const makePayment = {
  makePayment: defineAction({
    accept: "form",
    input: z.object({
      orderId: z.string(),
      paymentAcceptanceWalletSetId: z.string(),
      amount: z.string(),
      chain: z.string(),
    }),
    handler: async (input) => {
      const evmChains = {
        'ARB_SEPOLIA': chains.ARB_SEPOLIA,
        'AVAX_FUJI': chains.AVAX_FUJI,
        'BASE_SEPOLIA': chains.BASE_SEPOLIA,
        'ETH_SEPOLIA': chains.ETH_SEPOLIA,
        'MATIC_AMOY': chains.MATIC_AMOY,
        'OP_SEPOLIA': chains.OP_SEPOLIA,
        'UNI_SEPOLIA': chains.UNI_SEPOLIA,
      };
      const selectedChain = evmChains[input.chain as keyof typeof evmChains] || chains.ETH_SEPOLIA;
      
      const client = createCircleClient({
        apiKey: `${getSecret("API_KEY")}`,
        entitySecret: `${getSecret("ENTITY_SECRET")}`,
        chain: selectedChain,
        logLevel: 'debug'
      })

      const order = {
        id: input.orderId,
        token: selectedChain.contracts.USDC,
        amount: input.amount,
      } as const

      const paymentAcceptanceWallet = await client.createAccount({
        refId: `order-${input.orderId}`,
        walletSetId: input.paymentAcceptanceWalletSetId,
        chain: selectedChain,
      })

      const paymentLink = await client.generateTransferLink({
        to: paymentAcceptanceWallet,
        amount: `${order.amount}` as `${number}`,
        token: order.token,
        chain: selectedChain,
      })

      const encodedPaymentLink = encodeURIComponent(paymentLink)

      const info = {
        paymentAcceptanceWallet: {
          address: paymentAcceptanceWallet.address
        },
        orderId: input.orderId,
        amount: input.amount,
        paymentLink: paymentLink,
        encodedPaymentLink: encodedPaymentLink
      };
      return info;
    },
  }),
}