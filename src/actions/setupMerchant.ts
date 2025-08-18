import { defineAction } from 'astro:actions';
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

export const setupMerchant = {
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
      const paymentAcceptanceWalletSet = await client.createWalletSet({
        name: `${slugify(input.merchantName)}-pa-wallet-set`,
      })

      const merchantWallet = await client.createAccount({
        walletSetId: merchantWalletSet.id,
        refId: `${slugify(input.merchantName)}-wallet`,
        chain: ETH_SEPOLIA,
      })
      await client.drip({ account: merchantWallet, token: null, chain: ETH_SEPOLIA })
      await new Promise(resolve => setTimeout(resolve, 10000))

      db.data.merchants.push({
        name: input.merchantName,
        walletSetName: `${slugify(input.merchantName)}-wallet-set`,
        walletSetId: merchantWalletSet.id,
        walletId: merchantWallet.address,
        paymentAcceptanceWalletName: `${slugify(input.merchantName)}-pa-wallet-set`,
        paymentAcceptanceWalletSetId: paymentAcceptanceWalletSet.id
      })
      await db.write();

      const info = {
        walletSetId: merchantWalletSet.id,
        paymentAcceptanceWalletSetId: paymentAcceptanceWalletSet.id
      };
      return info;
    },
  }),
}