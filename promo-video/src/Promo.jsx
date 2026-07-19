// Video de presentation Snap Tap (28 s, 1080x1920) — montre le VRAI gameplay :
// annonce du VIP → main du joueur → selection → choix du VIP → transition →
// Mode Apero (mise de gorgees) → pitch → QR. Identite du jeu (Anton,
// jaune/rose/noir, mode projecteur sombre pour le reveal).
// Pas de son integre : musique ajoutee dans TikTok/IG au moment de poster.
//
// REGLE EDITORIALE : aucune vraie personne ni marque dans les visuels
// marketing — cartes generiques du deck uniquement. (Les prenoms de joueurs
// fictifs comme LEA sont OK.)
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Img,
  staticFile,
} from 'remotion';
import { loadFont } from '@remotion/fonts';

loadFont({ family: 'Anton', url: staticFile('Anton-Regular.ttf') });

const YELLOW = '#FFE600';
const PINK = '#FF2D6F';
const GREEN = '#00C853';
const RED = '#FF1744';

const anton = {
  fontFamily: 'Anton, sans-serif',
  textTransform: 'uppercase',
  color: '#000',
};

// ---------- Briques visuelles ----------

const Logo = ({ scale = 1 }) => (
  <div
    style={{
      transform: `scale(${scale})`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}
  >
    <div style={{ ...anton, fontSize: 210, lineHeight: 0.85 }}>SNAP</div>
    <div
      style={{
        ...anton,
        fontSize: 120,
        lineHeight: 1,
        color: '#fff',
        backgroundColor: PINK,
        border: '10px solid #000',
        boxShadow: '14px 14px 0 #000',
        padding: '10px 48px 18px',
        transform: 'rotate(-3deg)',
        marginTop: 10,
      }}
    >
      TAP
    </div>
  </div>
);

const Chip = ({ text, bg, color = '#fff', tilt = -2, fontSize = 72 }) => (
  <div
    style={{
      ...anton,
      display: 'inline-block',
      color,
      backgroundColor: bg,
      border: '8px solid #000',
      boxShadow: '10px 10px 0 #000',
      padding: '14px 44px 22px',
      fontSize,
      lineHeight: 1,
      transform: `rotate(${tilt}deg)`,
      whiteSpace: 'nowrap',
    }}
  >
    {text}
  </div>
);

// ---------- Animations ----------

const Stamp = ({ children, delay = 0, from = 2.6 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 14, stiffness: 220 },
  });
  const scale = interpolate(s, [0, 1], [from, 1]);
  return (
    <div style={{ transform: `scale(${scale})`, opacity: frame < delay ? 0 : 1 }}>
      {children}
    </div>
  );
};

const SlideUp = ({ children, delay = 0, dist = 900 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - delay,
    fps,
    config: { damping: 16, stiffness: 130 },
  });
  const y = interpolate(s, [0, 1], [dist, 0]);
  return (
    <div style={{ transform: `translateY(${y}px)`, opacity: frame < delay ? 0 : 1 }}>
      {children}
    </div>
  );
};

// Rond de "tap" : un doigt invisible qui touche l'ecran a l'instant `delay`.
const TapRing = ({ delay }) => {
  const frame = useCurrentFrame();
  const t = frame - delay;
  if (t < 0 || t > 18) return null;
  const scale = interpolate(t, [0, 14], [0.4, 1.7], { extrapolateRight: 'clamp' });
  const opacity = interpolate(t, [0, 4, 16], [0, 0.85, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: 150,
        height: 150,
        marginLeft: -75,
        marginTop: -75,
        borderRadius: '50%',
        border: '12px solid #000',
        backgroundColor: 'rgba(255,255,255,0.35)',
        transform: `scale(${scale})`,
        opacity,
        zIndex: 10,
      }}
    />
  );
};

const Center = ({ children, style = {} }) => (
  <AbsoluteFill
    style={{
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      ...style,
    }}
  >
    {children}
  </AbsoluteFill>
);

// ---------- 1. Logo (0 → 75) ----------

const SceneLogo = () => (
  <Center>
    <Stamp from={3.2}>
      <Logo />
    </Stamp>
    <div style={{ height: 90 }} />
    <Stamp delay={22}>
      <Chip text="LE JEU D'APÉRO" bg="#000" color={YELLOW} tilt={-2} />
    </Stamp>
  </Center>
);

// ---------- 2. Annonce du VIP + ta main + selection (75 → 255) ----------

const HAND = ['GARDER LES CHAUSSETTES', 'RACLETTE', 'CAMPING SAUVAGE', 'APPELER TON EX'];
const SELECTED = 3; // index de la carte tapee (APPELER TON EX)
const TAP_AT = 95; // frame locale du tap
const BTN_AT = 112; // le bouton "jouer" apparait
const PRESS_AT = 150; // ... et se fait presser

const HandCard = ({ text, selected, popDelay }) => (
  <Stamp delay={popDelay} from={1.5}>
    <div
      style={{
        ...anton,
        position: 'relative',
        width: 440,
        height: 280,
        backgroundColor: selected ? PINK : '#fff',
        color: selected ? '#fff' : '#000',
        border: '10px solid #000',
        boxShadow: selected ? '16px 16px 0 #000' : '10px 10px 0 #000',
        transform: selected ? 'translate(-6px,-6px)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: 54,
        lineHeight: 0.95,
        padding: 30,
      }}
    >
      {text}
    </div>
  </Stamp>
);

const SceneHand = () => {
  const frame = useCurrentFrame();
  const pressed = frame >= PRESS_AT;
  return (
    <Center>
      <Stamp delay={0}>
        <Chip text="LÉA VEUT : J'AIME PAS 💔" bg={RED} tilt={-2} fontSize={58} />
      </Stamp>
      <div style={{ height: 40 }} />
      <Stamp delay={16} from={1.4}>
        <div style={{ ...anton, fontSize: 52, opacity: 0.75 }}>TA MAIN — POSE TA CARTE</div>
      </Stamp>
      <div style={{ height: 55 }} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '440px 440px',
          gap: 45,
        }}
      >
        {HAND.map((t, i) => (
          <div key={t} style={{ position: 'relative' }}>
            <HandCard
              text={t}
              selected={i === SELECTED && frame >= TAP_AT + 4}
              popDelay={22 + i * 9}
            />
            {i === SELECTED && <TapRing delay={TAP_AT} />}
          </div>
        ))}
      </div>
      <div style={{ height: 80 }} />
      <SlideUp delay={BTN_AT} dist={300}>
        <div
          style={{
            ...anton,
            backgroundColor: '#000',
            color: '#fff',
            border: '10px solid #000',
            boxShadow: pressed ? '4px 4px 0 #000' : '12px 12px 0 #000',
            transform: pressed ? 'translate(6px,6px)' : 'none',
            padding: '26px 70px 34px',
            fontSize: 62,
            lineHeight: 1,
          }}
        >
          JOUER CETTE CARTE ▸
        </div>
      </SlideUp>
    </Center>
  );
};

// ---------- 3. Le VIP choisit (mode projecteur sombre) (255 → 380) ----------

const PICK_AT = 58; // frame locale du choix
const PLAYED = ['RACLETTE', 'APPELER TON EX', 'DORMIR 18H', 'MOUSTIQUES EN ÉTÉ'];
const PICKED = 1;

const SceneReveal = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <Center>
        <Stamp delay={0}>
          <div style={{ ...anton, fontSize: 68, color: '#fff' }}>
            👀 LÉA CHOISIT…
          </div>
        </Stamp>
        <div style={{ height: 70 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '440px 440px', gap: 45 }}>
          {PLAYED.map((t, i) => {
            const picked = i === PICKED && frame >= PICK_AT;
            return (
              <div key={t} style={{ position: 'relative' }}>
                <Stamp delay={10 + i * 8} from={1.3}>
                  <div
                    style={{
                      ...anton,
                      width: 440,
                      height: 280,
                      backgroundColor: picked ? '#fff' : '#33333a',
                      color: picked ? '#000' : '#c9c9d2',
                      border: picked ? `10px solid ${PINK}` : '10px solid #55555f',
                      boxShadow: picked ? `0 0 60px ${PINK}` : 'none',
                      transform: picked ? 'scale(1.07) rotate(-2deg)' : 'rotate(-1deg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      fontSize: 54,
                      lineHeight: 0.95,
                      padding: 30,
                    }}
                  >
                    {t}
                  </div>
                </Stamp>
                {i === PICKED && <TapRing delay={PICK_AT - 4} />}
              </div>
            );
          })}
        </div>
        <div style={{ height: 90 }} />
        <Stamp delay={PICK_AT + 22} from={3}>
          <Chip text="+1 POINT 🎉" bg="#000" color={YELLOW} tilt={-3} fontSize={84} />
        </Stamp>
      </Center>
    </AbsoluteFill>
  );
};

// ---------- 4. Transition (380 → 440) ----------

const SceneTransition = () => (
  <AbsoluteFill style={{ backgroundColor: '#000' }}>
    <Center>
      <Stamp from={2.8}>
        <div style={{ ...anton, fontSize: 96, color: '#fff', textAlign: 'center', lineHeight: 1.05 }}>
          ET EN
          <br />
          <span style={{ color: YELLOW }}>MODE APÉRO</span> ?
        </div>
      </Stamp>
      <div style={{ height: 50 }} />
      <Stamp delay={18} from={3.5}>
        <div style={{ fontSize: 140, lineHeight: 1 }}>🍻</div>
      </Stamp>
    </Center>
  </AbsoluteFill>
);

// ---------- 5. Mode Apero : la mise de gorgees (440 → 610) ----------

const BET_TAP_AT = 78; // frame locale : tap sur la mise "3"
const BET = 2; // index (0-based) → bouton "3"

const SceneApero = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Img
        src={staticFile('apero-bg.webp')}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <Center>
        <Stamp from={3}>
          <Chip text="🍻 MODE APÉRO" bg={PINK} tilt={-2} fontSize={88} />
        </Stamp>
        <div style={{ height: 80 }} />
        <SlideUp delay={22} dist={500}>
          <div
            style={{
              ...anton,
              backgroundColor: '#fff',
              border: '12px solid #000',
              boxShadow: '16px 16px 0 #000',
              padding: '40px 50px',
              fontSize: 76,
              lineHeight: 0.95,
              textAlign: 'center',
              transform: 'rotate(-2deg)',
              maxWidth: 860,
            }}
          >
            MISE TES GORGÉES SUR TA CARTE
          </div>
        </SlideUp>
        <div style={{ height: 75 }} />
        <div style={{ display: 'flex', gap: 35 }}>
          {[1, 2, 3, 4].map((n, i) => {
            const on = i === BET && frame >= BET_TAP_AT + 4;
            return (
              <div key={n} style={{ position: 'relative' }}>
                <Stamp delay={48 + i * 7} from={1.5}>
                  <div
                    style={{
                      ...anton,
                      width: 150,
                      height: 150,
                      backgroundColor: on ? PINK : '#fff',
                      color: on ? '#fff' : '#000',
                      border: '10px solid #000',
                      boxShadow: on ? '14px 14px 0 #000' : '8px 8px 0 #000',
                      transform: on ? 'translate(-5px,-5px)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 80,
                      lineHeight: 1,
                    }}
                  >
                    {n}
                  </div>
                </Stamp>
                {i === BET && <TapRing delay={BET_TAP_AT} />}
              </div>
            );
          })}
        </div>
        <div style={{ height: 95 }} />
        <Stamp delay={BET_TAP_AT + 30} from={3.2}>
          <Chip text="TOUT LE MONDE BOIT 3 🍺" bg={PINK} tilt={3} fontSize={66} />
        </Stamp>
      </Center>
    </AbsoluteFill>
  );
};

// ---------- 6. Pitch (610 → 715) ----------

const ScenePitch = () => (
  <Center>
    <Stamp delay={0}>
      <Chip text="3 À 16 JOUEURS" bg="#000" color={YELLOW} tilt={-2} fontSize={78} />
    </Stamp>
    <div style={{ height: 70 }} />
    <Stamp delay={24}>
      <Chip text="CHACUN SUR SON TEL" bg="#fff" color="#000" tilt={2} fontSize={78} />
    </Stamp>
    <div style={{ height: 70 }} />
    <Stamp delay={48} from={3.4}>
      <Chip text="GRATUIT" bg={PINK} tilt={-3} fontSize={120} />
    </Stamp>
  </Center>
);

// ---------- 7. Fin : logo + QR + url (715 → 850) ----------

const SceneEnd = () => (
  <Center>
    <Stamp from={1.8}>
      <Logo scale={0.75} />
    </Stamp>
    <div style={{ height: 80 }} />
    <SlideUp delay={14} dist={500}>
      <div
        style={{
          backgroundColor: '#fff',
          border: '12px solid #000',
          boxShadow: '16px 16px 0 #000',
          padding: 28,
          transform: 'rotate(-2deg)',
        }}
      >
        <Img src={staticFile('qr.png')} style={{ width: 380, height: 380, display: 'block' }} />
      </div>
    </SlideUp>
    <div style={{ height: 80 }} />
    <Stamp delay={30}>
      <div style={{ ...anton, fontSize: 76 }}>SCANNE. JOUE.</div>
    </Stamp>
    <div style={{ height: 30 }} />
    <Stamp delay={42}>
      <div style={{ ...anton, fontSize: 58 }}>SNAPTAPPARTY.COM</div>
    </Stamp>
  </Center>
);

// ---------- Composition ----------

export const Promo = () => (
  <AbsoluteFill style={{ backgroundColor: YELLOW }}>
    <Sequence from={0} durationInFrames={75}>
      <SceneLogo />
    </Sequence>
    <Sequence from={75} durationInFrames={180}>
      <SceneHand />
    </Sequence>
    <Sequence from={255} durationInFrames={125}>
      <SceneReveal />
    </Sequence>
    <Sequence from={380} durationInFrames={60}>
      <SceneTransition />
    </Sequence>
    <Sequence from={440} durationInFrames={170}>
      <SceneApero />
    </Sequence>
    <Sequence from={610} durationInFrames={105}>
      <ScenePitch />
    </Sequence>
    <Sequence from={715} durationInFrames={135}>
      <SceneEnd />
    </Sequence>
  </AbsoluteFill>
);
