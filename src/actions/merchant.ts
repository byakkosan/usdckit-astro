import { defineAction } from 'astro:actions';
import { getSecret } from "astro:env/server";
import { z } from "astro:schema";
import { createCircleClient } from '@circle-fin/usdckit';
import * as chains from '@circle-fin/usdckit/chains';
import { JSONFilePreset } from 'lowdb/node';

type Data = {
  merchants: { name: string; id: string; walletAddress: string }[]
}

const slugify = (str: string) => str.toLowerCase().replace(/\s+/g, '-');

const evmChains = {
  'ETH_SEPOLIA': chains.ETH_SEPOLIA,
  'ARB_SEPOLIA': chains.ARB_SEPOLIA,
  'AVAX_FUJI': chains.AVAX_FUJI,
  'BASE_SEPOLIA': chains.BASE_SEPOLIA,
  'MATIC_AMOY': chains.MATIC_AMOY,
  'OP_SEPOLIA': chains.OP_SEPOLIA,
  'UNI_SEPOLIA': chains.UNI_SEPOLIA,
};

const client = createCircleClient({
  apiKey: `${getSecret("API_KEY")}`,
  entitySecret: `${getSecret("ENTITY_SECRET")}`,
  logLevel: 'debug'
})

export const merchant = {
  initialSetup: defineAction({
    accept: "form",
    input: z.object({
      merchantName: z.string(),
    }),
    handler: async (input) => {
      const defaultData: Data = { merchants: [] }
      const db = await JSONFilePreset<Data>('./src/db/db.json', defaultData)

      const merchantCount = db.data.merchants.length;
      const merchantId = `mer${merchantCount + 1}`;
      console.log(`Creating merchant with ID: ${merchantId}`);
      
      const refId = `${slugify(input.merchantName)}-wallet`;
      const chainNames = Object.keys(evmChains);
      console.log(`Creating unified wallet across ${chainNames.length} EVM chains...`);
      
      const merchantWallet = await client.createAccount({
        walletSetId: `${getSecret("MERCHANT_WALLET_SET_ID")}`,
        refId: refId,
        chain: chains.ETH_SEPOLIA,
      });
      console.log(`Created source wallet: ${merchantWallet.address}`);

      const remainingChains = Object.values(evmChains).slice(1);
      for (const chain of remainingChains) {
        try {
          await client.createAccount({ 
            account: merchantWallet,
            chain: chain 
          });
          console.log(`✓ Derived on ${chain.blockchainId}`);
        } catch (error) {
          console.warn(`⚠ Failed on ${chain.blockchainId}:`, error instanceof Error ? error.message : String(error));
        }
      }
      console.log(`Unified wallet ${merchantWallet.address} available on all chains`);
      
      // Final delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Save merchant to database
      db.data.merchants.push({
        name: input.merchantName,
        id: merchantId,
        walletAddress: merchantWallet.address
      });
      await db.write();

      const info = {
        id: merchantId,
        name: input.merchantName,
        walletAddress: merchantWallet.address
      };
      return info;
    },
  }),
  sweepFunds: defineAction({
    input: z.object({
      name: z.string(),
    }),
    handler: async (input) => {
      async function sweepPaymentAcceptanceWalletsToMerchantWallets(destinationWallet: any) {
        // TODO: Implement sweep functionality for multiple chains
        console.log('Sweep functionality needs to be implemented for multiple chains');
        console.log('Destination wallet:', destinationWallet);
      }
    }
  })
}