import { Composition } from 'remotion';
import { Promo } from './Promo.jsx';

// 1080x1920 (TikTok / Reels / Shorts), 30 fps, 20 s.
export const RemotionRoot = () => (
  <Composition
    id="SnapTapPromo"
    component={Promo}
    durationInFrames={600}
    fps={30}
    width={1080}
    height={1920}
  />
);
