// Achats integres via RevenueCat (Play Billing).
//
// Modele : 2 produits ponctuels NON consommables, chacun lie a un entitlement.
//   produit Play `mode_apero` → entitlement `apero`  (Mode Apero + Bourre-e)
//   produit Play `pack_ultra` → entitlement `ultra`  (7 categories premium)
//
// IMPORTANT : le plugin est NATIF. Sur le web (navigateur), Play Billing
// n'existe pas → BILLING_AVAILABLE = false, et on retombe sur l'ancien systeme
// (flag local apero pour le dev-unlock + Firebase pour ultra). Les achats ne se
// font donc que dans l'app Android installee. Import STATIQUE du plugin : son
// implementation web est un simple stub (ne plante qu'a l'APPEL, jamais a
// l'import), et on garde tous les appels derriere BILLING_AVAILABLE.
import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { getStoredAperoUnlock } from './utils';
import { subscribeMyPacks, ownsPack } from './entitlements';

// Cle API PUBLIQUE RevenueCat (Android). Publique = OK dans le bundle client.
const RC_ANDROID_KEY = 'goog_ztUJzGeJrxJXWgjrMDEntiQpvfE';

export const ENTITLEMENT_APERO = 'apero';
export const ENTITLEMENT_ULTRA = 'ultra';
export const PRODUCT_APERO = 'mode_apero';
export const PRODUCT_ULTRA = 'pack_ultra';

export const BILLING_AVAILABLE = Capacitor.isNativePlatform();

// Garde-fou : ne jamais laisser une promesse Play Billing bloquer l'UI a l'infini.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout ' + (label || '') + ' ' + ms + 'ms')), ms)
    ),
  ]);
}

let _configured = false;
export async function initPurchases() {
  if (!BILLING_AVAILABLE || _configured) return;
  try {
    await Purchases.setLogLevel({
      level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN,
    });
    await Purchases.configure({ apiKey: RC_ANDROID_KEY });
    _configured = true;
  } catch (e) {
    console.warn('[purchases] configure a echoue', e);
  }
}

// { apero: bool, ultra: bool } depuis un customerInfo RevenueCat.
function entFromInfo(info) {
  const active = info?.entitlements?.active || {};
  return {
    apero: !!active[ENTITLEMENT_APERO],
    ultra: !!active[ENTITLEMENT_ULTRA],
  };
}

// Recupere les 2 produits Play (achats ponctuels). type NON_SUBSCRIPTION car
// le SDK cherche des abonnements par defaut.
async function fetchProducts(ids) {
  const { products } = await withTimeout(
    Purchases.getProducts({ productIdentifiers: ids, type: 'NON_SUBSCRIPTION' }),
    15000,
    'getProducts'
  );
  return products || [];
}

// Hook central : possession + prix localises + achat + restauration.
// Retourne { apero, ultra, prices, billingAvailable, busy, purchase, restore }.
export function useBilling() {
  const [ent, setEnt] = useState({ apero: false, ultra: false });
  const [prices, setPrices] = useState({}); // { mode_apero: '4,99 €', ... }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!BILLING_AVAILABLE) {
      // --- Fallback web/dev : flag local apero + Firebase pour ultra ---
      const applyApero = () =>
        setEnt((e) => ({ ...e, apero: getStoredAperoUnlock() }));
      applyApero();
      const unsub = subscribeMyPacks((packs) =>
        setEnt((e) => ({ ...e, ultra: ownsPack(packs, PRODUCT_ULTRA) }))
      );
      window.addEventListener('focus', applyApero);
      return () => {
        unsub && unsub();
        window.removeEventListener('focus', applyApero);
      };
    }

    // --- Natif : RevenueCat est la source de verite ---
    let removeListener = null;
    (async () => {
      await initPurchases();
      try {
        const { customerInfo } = await Purchases.getCustomerInfo();
        if (mounted) setEnt(entFromInfo(customerInfo));
      } catch (e) {
        console.warn('[purchases] getCustomerInfo', e);
      }
      try {
        const handle = await Purchases.addCustomerInfoUpdateListener((info) => {
          if (mounted) setEnt(entFromInfo(info));
        });
        removeListener = handle;
      } catch { /* ignore */ }
      try {
        const products = await fetchProducts([PRODUCT_APERO, PRODUCT_ULTRA]);
        if (mounted && products.length) {
          const map = {};
          for (const p of products) map[p.identifier] = p.priceString;
          setPrices(map);
        }
      } catch (e) {
        console.warn('[purchases] getProducts', e);
      }
    })();

    return () => {
      mounted = false;
      if (removeListener && typeof removeListener.remove === 'function') {
        removeListener.remove();
      }
    };
  }, []);

  // Achat d'un produit (mode_apero | pack_ultra).
  const purchase = useCallback(async (productId) => {
    if (!BILLING_AVAILABLE) return false;
    setBusy(true);
    try {
      await initPurchases();
      const products = await fetchProducts([productId]);
      const product = products[0];
      if (!product) throw new Error('Produit introuvable : ' + productId);
      const { customerInfo } = await Purchases.purchaseStoreProduct({ product });
      const next = entFromInfo(customerInfo);
      setEnt(next);
      return next;
    } catch (e) {
      if (e?.code === 'PURCHASE_CANCELLED' || e?.userCancelled) return false;
      console.warn('[purchases] purchase', e);
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  // Restauration (reinstall / changement de tel).
  const restore = useCallback(async () => {
    if (!BILLING_AVAILABLE) return false;
    setBusy(true);
    try {
      await initPurchases();
      const { customerInfo } = await withTimeout(
        Purchases.restorePurchases(),
        30000,
        'restore'
      );
      const next = entFromInfo(customerInfo);
      setEnt(next);
      return next;
    } catch (e) {
      console.warn('[purchases] restore', e);
      throw e;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    apero: ent.apero,
    ultra: ent.ultra,
    prices,
    billingAvailable: BILLING_AVAILABLE,
    busy,
    purchase,
    restore,
  };
}
