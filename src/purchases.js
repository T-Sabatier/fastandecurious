// Achats integres via RevenueCat (Play Billing).
//
// Modele : 2 produits ponctuels NON consommables, chacun lie a un entitlement.
//   produit Play `mode_apero` → entitlement `apero`  (Mode Apero + Bourre-e)
//   produit Play `pack_ultra` → entitlement `ultra`  (7 categories premium)
//
// IMPORTANT : le plugin est NATIF. Sur le web (navigateur), Play Billing
// n'existe pas → BILLING_AVAILABLE = false, et on retombe sur l'ancien systeme
// (flag local apero pour le dev-unlock + Firebase pour ultra). Les achats ne se
// font donc que dans l'app Android installee.
import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { getStoredAperoUnlock } from './utils';
import { subscribeMyPacks, ownsPack } from './entitlements';

// Cle API PUBLIQUE RevenueCat (Android). Publique = OK dans le bundle client.
const RC_ANDROID_KEY = 'goog_ztUJzGeJrxJXWgjrMDEntiQpvfE';

export const ENTITLEMENT_APERO = 'apero';
export const ENTITLEMENT_ULTRA = 'ultra';
export const PRODUCT_APERO = 'mode_apero';
export const PRODUCT_ULTRA = 'pack_ultra';

export const BILLING_AVAILABLE = Capacitor.isNativePlatform();

// Import paresseux du plugin : uniquement en natif, pour ne pas charger de code
// natif cote web (ou il n'est pas implemente).
let _pkg = null;
async function rc() {
  if (!_pkg) _pkg = await import('@revenuecat/purchases-capacitor');
  return _pkg.Purchases;
}

let _configured = false;
export async function initPurchases() {
  if (!BILLING_AVAILABLE || _configured) return;
  try {
    const Purchases = await rc();
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
      // Le dev-unlock ecrit dans localStorage : on re-lit au focus.
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
      const Purchases = await rc();
      try {
        const { customerInfo } = await Purchases.getCustomerInfo();
        if (mounted) setEnt(entFromInfo(customerInfo));
      } catch (e) {
        console.warn('[purchases] getCustomerInfo', e);
      }
      // Mises a jour temps reel (achat, restauration, notif serveur).
      try {
        const handle = await Purchases.addCustomerInfoUpdateListener((info) => {
          if (mounted) setEnt(entFromInfo(info));
        });
        removeListener = handle;
      } catch { /* ignore */ }
      // Prix localises (obligatoire cote Play : afficher le prix du store).
      try {
        const { products } = await Purchases.getProducts({
          productIdentifiers: [PRODUCT_APERO, PRODUCT_ULTRA],
          // Nos produits sont des achats ponctuels (defaut du SDK = SUBSCRIPTION).
          type: 'NON_SUBSCRIPTION',
        });
        if (mounted && products) {
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

  // Achat d'un produit (mode_apero | pack_ultra). Retourne true si possede apres.
  const purchase = useCallback(async (productId) => {
    if (!BILLING_AVAILABLE) return false;
    setBusy(true);
    try {
      const Purchases = await rc();
      const { products } = await Purchases.getProducts({
        productIdentifiers: [productId],
        type: 'NON_SUBSCRIPTION',
      });
      const product = products && products[0];
      if (!product) throw new Error('Produit introuvable : ' + productId);
      const { customerInfo } = await Purchases.purchaseStoreProduct({ product });
      setEnt(entFromInfo(customerInfo));
      return entFromInfo(customerInfo);
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
      const Purchases = await rc();
      const { customerInfo } = await Purchases.restorePurchases();
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
