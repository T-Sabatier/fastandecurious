// Video de presentation Snap Tap (20 s, 1080x1920) — motion design "PowerPoint
// qui claque" dans l'identite du jeu : Anton, jaune/rose/noir, brutaliste.
// Aucun son integre : ajouter une musique tendance directement dans TikTok/IG
// au moment de poster (meilleur pour l'algorithme).
//
// REGLE EDITORIALE (comme gen-promo.mjs) : aucune vraie personne ni marque
// dans les visuels marketing — cartes generiques du deck uniquement.
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

// ---------- Briques visuelles (memes codes que le jeu) ----------

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

const Card = ({ children, tilt = -2, fontSize = 104, w = 780, minH = 420 }) => (
  <div
    style={{
      ...anton,
      width: w,
      minHeight: minH,
      backgroundColor: '#fff',
      border: '12px solid #000',
      boxShadow: '18px 18px 0 #000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      fontSize,
      lineHeight: 0.95,
      padding: 48,
      transform: `rotate(${tilt}deg)`,
    }}
  >
    {children}
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

// Tampon : l'element s'ecrase de "gros" vers sa taille normale (effet stamp).
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

// Glisse depuis le bas avec rebond.
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

// ---------- Scenes ----------

// 1. Logo qui claque (0 → 60)
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

// 2. Le concept : une carte + les deux votes (60 → 165)
const SceneConcept = () => (
  <Center>
    <div style={{ marginBottom: 70 }}>
      <Stamp delay={4}>
        <div style={{ ...anton, fontSize: 84 }}>T'AIMES OU PAS ?</div>
      </Stamp>
    </div>
    <SlideUp delay={15}>
      <Card>ANANAS SUR LA PIZZA</Card>
    </SlideUp>
    <div style={{ height: 90 }} />
    <div style={{ display: 'flex', gap: 40 }}>
      <Stamp delay={60}>
        <Chip text="J'AIME" bg={GREEN} color="#000" tilt={-4} />
      </Stamp>
      <Stamp delay={85}>
        <Chip text="J'AIME PAS" bg={RED} tilt={3} />
      </Stamp>
    </div>
  </Center>
);

// 3. Montage de cartes CLIVANTES avec verdict (3 cartes, ~1,7 s chacune —
// assez lent pour lire ET reagir). Choisir des cartes qui divisent vraiment.
const MONTAGE = [
  { t: 'GARDER LES CHAUSSETTES', like: false, tilt: -3 },
  { t: 'APPELER TON EX', like: true, tilt: 2 },
  { t: 'CAMPING SAUVAGE', like: false, tilt: -2 },
];

const MontageItem = ({ t, like, tilt }) => (
  <Center>
    <Stamp from={1.6}>
      <Card tilt={tilt} fontSize={96} minH={380}>
        {t}
      </Card>
    </Stamp>
    <div style={{ height: 80 }} />
    <Stamp delay={18} from={3}>
      <Chip
        text={like ? "J'AIME" : "J'AIME PAS"}
        bg={like ? GREEN : RED}
        color={like ? '#000' : '#fff'}
        tilt={like ? -5 : 4}
        fontSize={84}
      />
    </Stamp>
  </Center>
);

// 3 bis. Mode Apero : fond biere + regles du jeu a boire (assets du jeu).
const SceneApero = () => (
  <AbsoluteFill>
    <Img
      src={staticFile('apero-bg.webp')}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
    <Center>
      <Stamp from={3}>
        <Chip text="🍻 MODE APÉRO" bg={PINK} tilt={-2} fontSize={92} />
      </Stamp>
      <div style={{ height: 90 }} />
      <SlideUp delay={25} dist={600}>
        <Card tilt={-2} fontSize={88} minH={300} w={820}>
          MISE TES GORGÉES SUR TA CARTE
        </Card>
      </SlideUp>
      <div style={{ height: 70 }} />
      <Stamp delay={60} from={2.4}>
        <Chip
          text="TA CARTE GAGNE = ILS BOIVENT"
          bg="#000"
          color={YELLOW}
          tilt={2}
          fontSize={54}
        />
      </Stamp>
    </Center>
  </AbsoluteFill>
);

// 4. Le pitch
const ScenePitch = () => (
  <Center>
    <Stamp delay={0}>
      <Chip text="3 À 16 JOUEURS" bg="#000" color={YELLOW} tilt={-2} fontSize={78} />
    </Stamp>
    <div style={{ height: 70 }} />
    <Stamp delay={28}>
      <Chip text="CHACUN SUR SON TEL" bg="#fff" color="#000" tilt={2} fontSize={78} />
    </Stamp>
    <div style={{ height: 70 }} />
    <Stamp delay={56} from={3.4}>
      <Chip text="GRATUIT" bg={PINK} tilt={-3} fontSize={120} />
    </Stamp>
  </Center>
);

// 5. Fin : logo + QR + url (460 → 600)
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
    <Sequence from={75} durationInFrames={135}>
      <SceneConcept />
    </Sequence>
    {MONTAGE.map((m, i) => (
      <Sequence key={m.t} from={210 + i * 50} durationInFrames={50}>
        <MontageItem {...m} />
      </Sequence>
    ))}
    <Sequence from={360} durationInFrames={135}>
      <SceneApero />
    </Sequence>
    <Sequence from={495} durationInFrames={120}>
      <ScenePitch />
    </Sequence>
    <Sequence from={615} durationInFrames={135}>
      <SceneEnd />
    </Sequence>
  </AbsoluteFill>
);
