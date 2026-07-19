// Video de presentation Snap Tap (~32 s, 1080x1920) — SIMULATION D'UNE VRAIE
// PARTIE, ecrans copies de Game.jsx : TopBar (Quitter / Room / statut),
// scoreboard, banniere de mode avec prenom colore, main + selection, mode
// projecteur (choix du VIP), ecran resultat "Carte choisie / Posee par",
// puis la meme boucle en MODE APERO (mise de gorgees + "Tout le monde boit").
// Pas de son integre : musique ajoutee dans TikTok/IG au moment de poster.
//
// REGLE EDITORIALE : aucune vraie personne ni marque — cartes generiques qui
// parlent aux jeunes, pas de coquin (la video reste tous publics).
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

// Couleurs du jeu (cards.js)
const YELLOW = '#FFE600';
const AMBER = '#FBB417';
const PINK = '#FF2D6F';
const LIKE_GREEN = '#00C853';
const DISLIKE_RED = '#FF1744';

const anton = {
  fontFamily: 'Anton, sans-serif',
  textTransform: 'uppercase',
  color: '#000',
};

// Style "sticker" des pseudos (NAME_STYLE du jeu : blanc + contour noir).
const nameStyle = {
  color: '#fff',
  WebkitTextStroke: '0.10em #000',
  paintOrder: 'stroke fill',
  letterSpacing: '0.06em',
};

// Joueurs (vraies couleurs PLAYER_COLORS). LÉA = VIP de la manche classique.
const LEA = '#FF0040';
const SARAH = '#00E676';
const MAX = '#00B0FF';
const PLAYERS = [
  { n: 'LÉA', c: LEA, score: 2, vip: true },
  { n: 'MAX', c: MAX, score: 1 },
  { n: 'SARAH', c: SARAH, score: 2 },
  { n: 'TOM', c: '#FF6D00', score: 0 },
  { n: 'JUJU', c: '#D500F9', score: 1 },
];

// ---------- Habillage de partie (TopBar + Scoreboard, copie de Game.jsx) ----------

const TopBar = ({ right, bg = YELLOW }) => (
  <div
    style={{
      backgroundColor: bg,
      borderBottom: '8px solid #000',
      padding: '26px 44px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}
  >
    <div style={{ ...anton, fontSize: 34, opacity: 0.85 }}>↩ QUITTER</div>
    <div style={{ ...anton, fontSize: 46 }}>ROOM KZ4P</div>
    <div style={{ ...anton, fontSize: 32, opacity: 0.75, minWidth: 150, textAlign: 'right' }}>
      {right}
    </div>
  </div>
);

const Scoreboard = ({ vip = 'LÉA' }) => (
  <div
    style={{
      backgroundColor: 'rgba(255,255,255,0.4)',
      borderBottom: '8px solid #000',
      padding: '20px 24px',
      display: 'flex',
      justifyContent: 'center',
      gap: 20,
      flexWrap: 'wrap',
    }}
  >
    {PLAYERS.map((p) => (
      <div
        key={p.n}
        style={{
          backgroundColor: p.c,
          border: '5px solid #000',
          outline: p.n === vip ? `6px solid ${YELLOW}` : 'none',
          outlineOffset: 2,
          padding: '8px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ ...anton, ...nameStyle, fontSize: 38, lineHeight: 1 }}>{p.n}</span>
        <span
          style={{
            ...anton,
            fontSize: 32,
            lineHeight: 1,
            backgroundColor: '#000',
            color: YELLOW,
            padding: '5px 13px 9px',
          }}
        >
          {p.score}
        </span>
      </div>
    ))}
  </div>
);

const GameChrome = ({ right, bg, vip }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 }}>
    <TopBar right={right} bg={bg} />
    <Scoreboard vip={vip} />
  </div>
);

// Barre du bas fixe (comme le jeu : fond couleur de base + bord noir).
const BottomBar = ({ children, bg = YELLOW }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 5,
      backgroundColor: bg,
      borderTop: '8px solid #000',
      padding: '36px 50px 56px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 28,
    }}
  >
    {children}
  </div>
);

// Banniere de mode (copie du jeu) : "<PRENOM> veut J'aime / J'aime pas".
const ModeBanner = ({ name, color, like }) => (
  <div
    style={{
      ...anton,
      backgroundColor: like ? LIKE_GREEN : DISLIKE_RED,
      color: like ? '#000' : '#fff',
      border: '8px solid #000',
      boxShadow: '10px 10px 0 #000',
      transform: `rotate(${like ? -1 : 1}deg)`,
      padding: '24px 44px 32px',
      fontSize: 58,
      lineHeight: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 24,
      whiteSpace: 'nowrap',
    }}
  >
    <span style={{ ...nameStyle, WebkitTextStroke: '0.08em #000', color }}>{name}</span>
    <span>VEUT {like ? "J'AIME" : "J'AIME PAS"}</span>
    <span style={{ fontSize: 64 }}>{like ? '💚' : '💔'}</span>
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

const CardBadge = ({ emoji, dim }) => (
  <span
    style={{
      position: 'absolute',
      top: 12,
      right: 18,
      fontSize: 42,
      lineHeight: 1,
      opacity: dim ? 0.55 : 0.8,
      filter: dim ? 'grayscale(0.6)' : 'none',
    }}
  >
    {emoji}
  </span>
);

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

// ---------- 2. Ecran PLAY classique : main + selection (75 → 245) ----------

const HAND = [
  { t: 'ANANAS SUR LA PIZZA', e: '🍕' },
  { t: 'MATCH SUR APPLI', e: '❤️' },
  { t: 'APPELER TON EX', e: '🍻' },
  { t: 'DORMIR 18H', e: '🤪' },
];
const SELECTED = 2; // APPELER TON EX
const TAP_AT = 85;
const PRESS_AT = 135;

const HandCard = ({ text, emoji, selected, popDelay }) => (
  <Stamp delay={popDelay} from={1.5}>
    <div
      style={{
        ...anton,
        position: 'relative',
        width: 440,
        height: 260,
        backgroundColor: selected ? PINK : '#fff',
        color: selected ? '#fff' : '#000',
        border: '10px solid #000',
        boxShadow: selected ? '16px 16px 0 #000' : '10px 10px 0 #000',
        transform: selected ? 'translate(-6px,-6px)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontSize: 52,
        lineHeight: 0.95,
        padding: '40px 28px 28px',
      }}
    >
      <CardBadge emoji={emoji} />
      {text}
    </div>
  </Stamp>
);

const PlayButton = ({ label, pressed }) => (
  <div
    style={{
      ...anton,
      width: '100%',
      textAlign: 'center',
      backgroundColor: '#000',
      color: '#fff',
      boxShadow: pressed ? '3px 3px 0 #000' : '10px 10px 0 #000',
      transform: pressed ? 'translate(5px,5px)' : 'none',
      padding: '30px 40px 40px',
      fontSize: 58,
      lineHeight: 1,
    }}
  >
    {label}
  </div>
);

const ScenePlay = () => {
  const frame = useCurrentFrame();
  const selected = frame >= TAP_AT + 4;
  return (
    <AbsoluteFill style={{ backgroundColor: YELLOW }}>
      <GameChrome right="0/4 POSÉ" />
      <Center style={{ paddingTop: 210, paddingBottom: 250 }}>
        <Stamp delay={2}>
          <ModeBanner name="LÉA" color={LEA} like={false} />
        </Stamp>
        <div style={{ height: 55 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '440px 440px', gap: 42 }}>
          {HAND.map((c, i) => (
            <div key={c.t} style={{ position: 'relative' }}>
              <HandCard
                text={c.t}
                emoji={c.e}
                selected={i === SELECTED && selected}
                popDelay={18 + i * 8}
              />
              {i === SELECTED && <TapRing delay={TAP_AT} />}
            </div>
          ))}
        </div>
      </Center>
      <BottomBar>
        <PlayButton
          label={selected ? 'JOUER CETTE CARTE ▸' : 'CHOISIS UNE CARTE'}
          pressed={frame >= PRESS_AT}
        />
      </BottomBar>
    </AbsoluteFill>
  );
};

// ---------- 3. Mode PROJECTEUR : Lea choisit (245 → 360) ----------

const PICK_AT = 60;
const PLAYED = [
  { t: 'MOUSTIQUES EN ÉTÉ', e: '🌿' },
  { t: 'APPELER TON EX', e: '🍻' },
  { t: 'SALLE DE SPORT À 18H', e: '☕' },
  { t: 'CAMPING SAUVAGE', e: '✈️' },
];
const PICKED = 1;

const SceneReveal = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <GameChrome right="4 CARTES" />
      <Center style={{ paddingTop: 210 }}>
        {/* En-tete projecteur : gros nom du VIP dans SA couleur + badge mode */}
        <Stamp delay={0} from={1.8}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 60, lineHeight: 1, marginBottom: 8 }}>👀</div>
            <div
              style={{
                ...anton,
                fontSize: 130,
                lineHeight: 0.95,
                color: LEA,
                WebkitTextStroke: '10px #000',
                paintOrder: 'stroke fill',
                letterSpacing: '0.06em',
              }}
            >
              LÉA
            </div>
            <div
              style={{
                ...anton,
                display: 'inline-block',
                marginTop: 14,
                border: `5px solid ${DISLIKE_RED}`,
                color: DISLIKE_RED,
                padding: '10px 24px 16px',
                fontSize: 40,
                lineHeight: 1,
              }}
            >
              💔 CHOISIT CE QU'ELLE AIME PAS
            </div>
          </div>
        </Stamp>
        <div style={{ height: 60 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '440px 440px', gap: 42 }}>
          {PLAYED.map((c, i) => {
            const picked = i === PICKED && frame >= PICK_AT;
            const rot = i % 2 === 0 ? -1.5 : 1.5;
            return (
              <div key={c.t} style={{ position: 'relative' }}>
                <Stamp delay={12 + i * 8} from={1.3}>
                  <div
                    style={{
                      ...anton,
                      position: 'relative',
                      width: 440,
                      height: 260,
                      backgroundColor: picked ? '#fff' : '#33333a',
                      color: picked ? '#000' : '#c9c9d2',
                      border: picked ? `10px solid ${PINK}` : '10px solid #55555f',
                      boxShadow: picked ? `0 0 0 8px ${PINK}, 0 0 70px ${PINK}` : 'none',
                      transform: picked ? `scale(1.07) rotate(${rot}deg)` : `rotate(${rot}deg)`,
                      opacity: picked ? 1 : 0.82,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      fontSize: 52,
                      lineHeight: 0.95,
                      padding: '40px 28px 28px',
                    }}
                  >
                    <CardBadge emoji={c.e} dim={!picked} />
                    {c.t}
                  </div>
                </Stamp>
                {i === PICKED && <TapRing delay={PICK_AT - 4} />}
              </div>
            );
          })}
        </div>
      </Center>
    </AbsoluteFill>
  );
};

// ---------- 4. Ecran RESULTAT classique (360 → 460) ----------

const SceneResult = () => (
  <AbsoluteFill style={{ backgroundColor: YELLOW }}>
    <GameChrome right="" />
    <Center style={{ paddingTop: 210 }}>
      <Stamp delay={0} from={1.5}>
        <div style={{ ...anton, fontSize: 38, opacity: 0.6 }}>CARTE CHOISIE</div>
      </Stamp>
      <div style={{ height: 30 }} />
      <Stamp delay={6}>
        <div
          style={{
            ...anton,
            position: 'relative',
            width: 700,
            backgroundColor: '#000',
            color: YELLOW,
            border: '10px solid #000',
            boxShadow: '18px 18px 0 #000',
            transform: 'rotate(-2deg)',
            padding: '70px 50px',
            fontSize: 88,
            lineHeight: 0.95,
            textAlign: 'center',
          }}
        >
          <CardBadge emoji="🍻" />
          APPELER TON EX
        </div>
      </Stamp>
      <div style={{ height: 55 }} />
      <Stamp delay={30} from={1.5}>
        <div style={{ ...anton, fontSize: 38, opacity: 0.6 }}>POSÉE PAR</div>
      </Stamp>
      <div style={{ height: 20 }} />
      <Stamp delay={38} from={2}>
        <div
          style={{
            ...anton,
            fontSize: 150,
            lineHeight: 1,
            color: MAX,
            WebkitTextStroke: '10px #000',
            paintOrder: 'stroke fill',
            letterSpacing: '0.06em',
          }}
        >
          TOI 🎉
        </div>
      </Stamp>
      <div style={{ height: 55 }} />
      <Stamp delay={60} from={3}>
        <Chip text="+1 POINT" bg="#000" color={YELLOW} tilt={3} fontSize={80} />
      </Stamp>
    </Center>
  </AbsoluteFill>
);

// ---------- 5. Transition (460 → 520) ----------

const SceneTransition = () => (
  <AbsoluteFill style={{ backgroundColor: '#000' }}>
    <Center>
      <Stamp from={2.8}>
        <div
          style={{
            ...anton,
            fontSize: 96,
            color: '#fff',
            textAlign: 'center',
            lineHeight: 1.05,
          }}
        >
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

// ---------- 6. Ecran PLAY apero : mise de gorgees (520 → 700) ----------

const BET_TAP_AT = 70;
const BET = 2; // bouton "3"
const APERO_PRESS_AT = 130;

const SceneAperoPlay = () => {
  const frame = useCurrentFrame();
  const betOn = frame >= BET_TAP_AT + 4;
  return (
    <AbsoluteFill>
      <Img
        src={staticFile('apero-bg.webp')}
        style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <GameChrome right="🍻 APÉRO" bg={AMBER} vip="SARAH" />
      <Center style={{ paddingTop: 210, paddingBottom: 360 }}>
        <Stamp delay={2}>
          <ModeBanner name="SARAH" color={SARAH} like />
        </Stamp>
        <div style={{ height: 50 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '440px 440px', gap: 42 }}>
          {[
            { t: 'ANANAS SUR LA PIZZA', e: '🍕' },
            { t: 'MATCH SUR APPLI', e: '❤️' },
          ].map((c, i) => (
            <div key={c.t} style={{ position: 'relative' }}>
              <HandCard text={c.t} emoji={c.e} selected={i === 0 && frame >= 40} popDelay={16 + i * 8} />
              {i === 0 && <TapRing delay={36} />}
            </div>
          ))}
        </div>
      </Center>
      <BottomBar bg={AMBER}>
        {/* Selecteur de mise 1-4 (copie du jeu, partyMode) */}
        <div style={{ display: 'flex', gap: 28 }}>
          {[1, 2, 3, 4].map((n, i) => {
            const on = i === BET && betOn;
            return (
              <div key={n} style={{ position: 'relative' }}>
                <Stamp delay={20 + i * 6} from={1.4}>
                  <div
                    style={{
                      ...anton,
                      width: 140,
                      height: 120,
                      backgroundColor: on ? PINK : '#fff',
                      color: on ? '#fff' : '#000',
                      border: '10px solid #000',
                      boxShadow: on ? '12px 12px 0 #000' : '6px 6px 0 #000',
                      transform: on ? 'translate(-4px,-4px)' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 70,
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
        <PlayButton
          label={betOn ? 'JOUER · MISE 3 🍺' : 'MISE TES GORGÉES'}
          pressed={frame >= APERO_PRESS_AT}
        />
      </BottomBar>
    </AbsoluteFill>
  );
};

// ---------- 7. Ecran RESULTAT apero : tout le monde boit (700 → 800) ----------

const SceneAperoResult = () => (
  <AbsoluteFill>
    <Img
      src={staticFile('apero-bg.webp')}
      style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
    />
    <GameChrome right="🍻 APÉRO" bg={AMBER} vip="SARAH" />
    <Center style={{ paddingTop: 210 }}>
      <Stamp delay={0} from={1.5}>
        <div style={{ ...anton, fontSize: 38, opacity: 0.6 }}>CARTE CHOISIE</div>
      </Stamp>
      <div style={{ height: 30 }} />
      <Stamp delay={6}>
        <div
          style={{
            ...anton,
            position: 'relative',
            width: 700,
            backgroundColor: '#000',
            color: YELLOW,
            border: '10px solid #000',
            boxShadow: '18px 18px 0 #000',
            transform: 'rotate(-2deg)',
            padding: '70px 50px',
            fontSize: 88,
            lineHeight: 0.95,
            textAlign: 'center',
          }}
        >
          <CardBadge emoji="🍕" />
          ANANAS SUR LA PIZZA
        </div>
      </Stamp>
      <div style={{ height: 50 }} />
      <Stamp delay={28} from={1.5}>
        <div style={{ ...anton, fontSize: 38, opacity: 0.6 }}>POSÉE PAR</div>
      </Stamp>
      <div style={{ height: 20 }} />
      <Stamp delay={36} from={2}>
        <div
          style={{
            ...anton,
            fontSize: 130,
            lineHeight: 1,
            color: MAX,
            WebkitTextStroke: '10px #000',
            paintOrder: 'stroke fill',
            letterSpacing: '0.06em',
          }}
        >
          MAX
        </div>
      </Stamp>
      <div style={{ height: 55 }} />
      <Stamp delay={58} from={3.2}>
        <Chip text="TOUT LE MONDE BOIT 3" bg={PINK} tilt={3} fontSize={72} />
      </Stamp>
      <div style={{ height: 35 }} />
      <Stamp delay={80} from={1.5}>
        <div style={{ ...anton, fontSize: 34, opacity: 0.65 }}>
          LE GAGNANT NE BOIT PAS 😎
        </div>
      </Stamp>
    </Center>
  </AbsoluteFill>
);

// ---------- 8. Pitch (800 → 880) ----------

const ScenePitch = () => (
  <Center>
    <Stamp delay={0}>
      <Chip text="3 À 16 JOUEURS" bg="#000" color={YELLOW} tilt={-2} fontSize={78} />
    </Stamp>
    <div style={{ height: 70 }} />
    <Stamp delay={20}>
      <Chip text="CHACUN SUR SON TEL" bg="#fff" color="#000" tilt={2} fontSize={78} />
    </Stamp>
    <div style={{ height: 70 }} />
    <Stamp delay={40} from={3.4}>
      <Chip text="GRATUIT" bg={PINK} tilt={-3} fontSize={120} />
    </Stamp>
  </Center>
);

// ---------- 9. Fin : logo + QR + url (880 → 1000) ----------

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
    <Sequence from={75} durationInFrames={170}>
      <ScenePlay />
    </Sequence>
    <Sequence from={245} durationInFrames={115}>
      <SceneReveal />
    </Sequence>
    <Sequence from={360} durationInFrames={100}>
      <SceneResult />
    </Sequence>
    <Sequence from={460} durationInFrames={60}>
      <SceneTransition />
    </Sequence>
    <Sequence from={520} durationInFrames={180}>
      <SceneAperoPlay />
    </Sequence>
    <Sequence from={700} durationInFrames={100}>
      <SceneAperoResult />
    </Sequence>
    <Sequence from={800} durationInFrames={80}>
      <ScenePitch />
    </Sequence>
    <Sequence from={880} durationInFrames={120}>
      <SceneEnd />
    </Sequence>
  </AbsoluteFill>
);
