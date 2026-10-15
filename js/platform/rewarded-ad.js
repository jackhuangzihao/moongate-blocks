function createRewardedAds(api, adUnitId) {
  let ad, busy = false;
  return { show() {
    if (!adUnitId || !api.createRewardedVideoAd) return Promise.resolve('unavailable');
    if (busy) return Promise.resolve('busy');
    busy = true;
    return new Promise(resolve => {
      let settled = false, showing = false, timer;
      const finish = result => {
        if (settled) return;
        settled = true; busy = false; clearTimeout(timer);
        if (ad) {
          try { ad.offClose(close); ad.offError(error); } catch (_) {}
        }
        resolve(result);
      };
      // Missing/ambiguous completion data never grants a reward.
      const close = result => finish(showing && result && result.isEnded === true ? 'rewarded' : 'cancelled');
      const error = () => finish('failed');
      try {
        if (!ad) ad = api.createRewardedVideoAd({ adUnitId });
        ad.onClose(close); ad.onError(error);
        timer = setTimeout(error, 10000);
        Promise.resolve(ad.load()).then(() => {
          if (settled) return;
          clearTimeout(timer);
          showing = true;
          return ad.show();
        }).then(() => { if (!settled) clearTimeout(timer); }).catch(error);
      } catch (_) { error(); }
    });
  } };
}
module.exports = { createRewardedAds };
