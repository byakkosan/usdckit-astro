import { defineAction } from "astro:actions";
import { getSecret } from "astro:env/server";
import { z } from "astro:schema";
import { createCircleClient } from '@circle-fin/usdckit';
import { ETH_SEPOLIA } from '@circle-fin/usdckit/chains';
import { JSONFilePreset } from 'lowdb/node';

type Data = {
  merchants: { name: string; walletSetName: string; walletSetId: string; walletId: string; paymentAcceptanceWalletName: string; paymentAcceptanceWalletSetId: string }[]
}

const slugify = (str: string) => str.toLowerCase().replace(/\s+/g, '-');

const client = createCircleClient({
  apiKey: `${getSecret("API_KEY")}`,
  entitySecret: `${getSecret("ENTITY_SECRET")}`,
  chain: ETH_SEPOLIA,
  logLevel: 'debug'
})

export const server = {
  setupMerchant: defineAction({
    accept: "form",
    input: z.object({
      merchantName: z.string(),
    }),
    handler: async (input) => {
      const defaultData: Data = { merchants: [] }
      const db = await JSONFilePreset<Data>('./src/db/db.json', defaultData)

      const merchantWalletSet = await client.createWalletSet({
        name: `${slugify(input.merchantName)}-wallet-set`,
      })

      const merchantWalletSetId = merchantWalletSet.id
      const merchantWallet = await client.createAccount({
        walletSetId: merchantWalletSetId,
        refId: `${slugify(input.merchantName)}-wallet`,
        chain: ETH_SEPOLIA,
      })

      const paymentAcceptanceWalletSet = await client.createWalletSet({
        name: `${slugify(input.merchantName)}-pa-wallet-set`,
      })

      db.data.merchants.push({
        name: input.merchantName,
        walletSetName: `${slugify(input.merchantName)}-wallet-set`,
        walletSetId: merchantWalletSetId,
        walletId: merchantWallet.address,
        paymentAcceptanceWalletName: `${slugify(input.merchantName)}-pa-wallet-set`,
        paymentAcceptanceWalletSetId: paymentAcceptanceWalletSet.id
      })
      await db.write();

      const info = {
        walletSetId: merchantWalletSetId,
        paymentAcceptanceWalletSetId: paymentAcceptanceWalletSet.id
      };
      return info;
    },
  }),
  makePayment: defineAction({
    accept: "form",
    input: z.object({
      orderId: z.string(),
      paymentAcceptanceWalletSetId: z.string(),
      amount: z.string(),
    }),
    handler: async (input) => {
      const order = {
        id: input.orderId,
        token: ETH_SEPOLIA.contracts.USDC,
        amount: input.amount,
      } as const

      const paymentAcceptanceWallet = await client.createAccount({
        // Record Order ID on the wallet for reference
        refId: `order-${input.orderId}`,
        walletSetId: input.paymentAcceptanceWalletSetId,
        chain: ETH_SEPOLIA,
      })

      const paymentLink = await client.generateTransferLink({
        to: paymentAcceptanceWallet,
        amount: `${order.amount}` as `${number}`,
        token: order.token,
        chain: ETH_SEPOLIA,
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
};
