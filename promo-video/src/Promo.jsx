// Video de presentation Snap Tap (~32 s, 1080x1920) — simulation d'une VRAIE
// partie, lisible : des INTERTITRES expliquent chaque etape, puis on voit
// l'ecran du jeu correspondant (copie de Game.jsx), avec une main de 7 CARTES
// comme en vrai. Animations sobres : les ecrans sont poses, seuls les taps
// bougent. Pas de son integre (musique ajoutee dans TikTok/IG au post).
//
// REGLE EDITORIALE : aucune vraie personne ni marque — cartes generiques qui
// parlent aux jeunes, pas de coquin (video tous publics).
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

// NAME_STYLE du jeu : blanc + contour noir.
const nameStyle = {
  color: '#fff',
  WebkitTextStroke: '0.10em #000',
  paintOrder: 'stroke fill',
  letterSpacing: '0.06em',
};

const LEA = '#FF0040';
const SARAH = '#00E676';
const MAX = '#00B0FF';
const PLAYERS = [
  { n: 'LÉA', c: LEA, score: 2 },
  { n: 'MAX', c: MAX, score: 1 },
  { n: 'SARAH', c: SARAH, score: 2 },
  { n: 'TOM', c: '#FF6D00', score: 0 },
  { n: 'JUJU', c: '#D500F9', score: 1 },
];

// ---------- Habillage de partie (TopBar + Scoreboard, copie du jeu) ----------

const GameChrome = ({ right, bg = YELLOW, vip = 'LÉA' }) => (
  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 }}>
    <div
      style={{
        backgroundColor: bg,
        borderBottom: '7px solid #000',
        padding: '22px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div style={{ ...anton, fontSize: 30, opacity: 0.85 }}>↩ QUITTER</div>
      <div style={{ ...anton, fontSize: 42 }}>ROOM KZ4P</div>
      <div style={{ ...anton, fontSize: 28, opacity: 0.75, minWidth: 140, textAlign: 'right' }}>
        {right}
      </div>
    </div>
    <div
      style={{
        backgroundColor: 'rgba(255,255,255,0.4)',
        borderBottom: '7px solid #000',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'center',
        gap: 18,
      }}
    >
      {PLAYERS.map((p) => (
        <div
          key={p.n}
          style={{
            backgroundColor: p.c,
            border: '4px solid #000',
            outline: p.n === vip ? `5px solid ${YELLOW}` : 'none',
            outlineOffset: 2,
            padding: '7px 14px 11px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ ...anton, ...nameStyle, fontSize: 34, lineHeight: 1 }}>{p.n}</span>
          <span
            style={{
              ...anton,
              fontSize: 28,
              lineHeight: 1,
              backgroundColor: '#000',
              color: YELLOW,
              padding: '4px 11px 8px',
            }}
          >
            {p.score}
          </span>
        </div>
      ))}
    </div>
  </div>
);

const BottomBar = ({ children, bg = YELLOW }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 5,
      backgroundColor: bg,
      borderTop: '7px solid #000',
      padding: '30px 46px 46px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 24,
    }}
  >
    {children}
  </div>
);

const ModeBanner = ({ name, color, like }) => (
  <div
    style={{
      ...anton,
      backgroundColor: like ? LIKE_GREEN : DISLIKE_RED,
      color: like ? '#000' : '#fff',
      border: '7px solid #000',
      boxShadow: '9px 9px 0 #000',
      transform: `rotate(${like ? -1 : 1}deg)`,
      padding: '20px 38px 27px',
      fontSize: 52,
      lineHeight: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      whiteSpace: 'nowrap',
    }}
  >
    <span style={{ ...nameStyle, WebkitTextStroke: '0.08em #000', color }}>{name}</span>
    <span>VEUT {like ? "J'AIME" : "J'AIME PAS"}</span>
    <span style={{ fontSize: 56 }}>{like ? '💚' : '💔'}</span>
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

// Apparition douce (petit fondu + montee) : pour poser un ecran sans agitation.
const Appear = ({ children, delay = 0 }) => {
  const frame = useCurrentFrame();
  const t = frame - delay;
  const opacity = interpolate(t, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(t, [0, 12], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <div style={{ opacity, transform: `translateY(${y}px)` }}>{children}</div>;
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
        width: 130,
        height: 130,
        marginLeft: -65,
        marginTop: -65,
        borderRadius: '50%',
        border: '11px solid #000',
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

// ---------- Intertitres (une idee par ecran, on comprend le deroule) ----------

const Intertitle = ({ lines, emoji }) => (
  <AbsoluteFill style={{ backgroundColor: '#000' }}>
    <Center>
      <Stamp from={2.2}>
        <div
          style={{
            ...anton,
            fontSize: 92,
            color: '#fff',
            textAlign: 'center',
            lineHeight: 1.08,
          }}
        >
          {lines.map((l, i) => (
            <div key={i} style={{ color: i === lines.length - 1 ? YELLOW : '#fff' }}>
              {l}
            </div>
          ))}
        </div>
      </Stamp>
      {emoji && (
        <>
          <div style={{ height: 45 }} />
          <Stamp delay={12} from={3}>
            <div style={{ fontSize: 120, lineHeight: 1 }}>{emoji}</div>
          </Stamp>
        </>
      )}
    </Center>
  </AbsoluteFill>
);

// ---------- Cartes ----------

const CardBadge = ({ emoji, dim }) => (
  <span
    style={{
      position: 'absolute',
      top: 8,
      right: 14,
      fontSize: 34,
      lineHeight: 1,
      opacity: dim ? 0.55 : 0.8,
      filter: dim ? 'grayscale(0.6)' : 'none',
    }}
  >
    {emoji}
  </span>
);

// Carte de main compacte (proportions du jeu : petite, texte ajuste).
const SmallCard = ({ text, emoji, selected }) => (
  <div
    style={{
      ...anton,
      position: 'relative',
      width: 470,
      height: 205,
      backgroundColor: selected ? PINK : '#fff',
      color: selected ? '#fff' : '#000',
      border: '8px solid #000',
      boxShadow: selected ? '13px 13px 0 #000' : '8px 8px 0 #000',
      transform: selected ? 'translate(-5px,-5px)' : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      fontSize: 52,
      lineHeight: 0.95,
      padding: '34px 24px 24px',
    }}
  >
    <CardBadge emoji={emoji} />
    {text}
  </div>
);

// LA MAIN DE 7 CARTES (comme en vrai) — la vitrine du jeu. PUB = LECTURE
// ECLAIR : cartes de 1-2 mots, sauf 2 exceptions (les heroines de l'histoire).
const HAND = [
  { t: 'PIZZA ANANAS', e: '🍕' },
  { t: 'TÉLÉPORTATION', e: '🤪' },
  { t: 'APPELER TON EX', e: '🍻' },
  { t: 'RACLETTE', e: '🍕' },
  { t: 'MOJITO', e: '🥤' },
  { t: 'HARRY POTTER', e: '🎬' },
  { t: 'TATOUAGE', e: '☕' },
];

const HandGrid = ({ selectedIdx, tapAt }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '470px 470px', gap: 26 }}>
      {HAND.map((c, i) => (
        <div key={c.t} style={{ position: 'relative' }}>
          <Appear delay={6 + i * 3}>
            <SmallCard
              text={c.t}
              emoji={c.e}
              selected={i === selectedIdx && frame >= tapAt + 4}
            />
          </Appear>
          {i === selectedIdx && <TapRing delay={tapAt} />}
        </div>
      ))}
    </div>
  );
};

const PlayButton = ({ label, pressed }) => (
  <div
    style={{
      ...anton,
      width: '100%',
      textAlign: 'center',
      backgroundColor: '#000',
      color: '#fff',
      boxShadow: pressed ? '3px 3px 0 #000' : '9px 9px 0 #000',
      transform: pressed ? 'translate(4px,4px)' : 'none',
      padding: '26px 40px 36px',
      fontSize: 54,
      lineHeight: 1,
    }}
  >
    {label}
  </div>
);

// ---------- 1. Logo ----------

const SceneLogo = () => (
  <Center>
    <Stamp from={3.2}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
    </Stamp>
    <div style={{ height: 90 }} />
    <Stamp delay={22}>
      <Chip text="LE JEU D'APÉRO" bg="#000" color={YELLOW} tilt={-2} />
    </Stamp>
  </Center>
);

// ---------- 2. Ecran PLAY classique : 7 cartes, tap, jouer ----------

const TAP_AT = 70;
const PRESS_AT = 115;
const SELECTED = 2; // APPELER TON EX

const ScenePlay = () => {
  const frame = useCurrentFrame();
  const selected = frame >= TAP_AT + 4;
  return (
    <AbsoluteFill style={{ backgroundColor: YELLOW }}>
      <GameChrome right="0/4 POSÉ" />
      <Center style={{ paddingTop: 175, paddingBottom: 175 }}>
        <Appear delay={0}>
          <ModeBanner name="LÉA" color={LEA} like />
        </Appear>
        <div style={{ height: 38 }} />
        <HandGrid selectedIdx={SELECTED} tapAt={TAP_AT} />
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

// ---------- 3. Mode PROJECTEUR : Lea choisit parmi les 4 cartes posees ----------

const PICK_AT = 55;
const PLAYED = [
  { t: 'SIESTE', e: '☕' },
  { t: 'APPELER TON EX', e: '🍻' },
  { t: 'MARIAGE', e: '❤️' },
  { t: 'PASTIS', e: '🥤' },
];
const PICKED = 1;

const SceneReveal = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      <GameChrome right="4 CARTES" />
      <Center style={{ paddingTop: 190 }}>
        <Appear delay={0}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 54, lineHeight: 1, marginBottom: 8 }}>👀</div>
            <div
              style={{
                ...anton,
                fontSize: 120,
                lineHeight: 0.95,
                color: LEA,
                WebkitTextStroke: '9px #000',
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
                marginTop: 12,
                border: `4px solid ${LIKE_GREEN}`,
                color: LIKE_GREEN,
                padding: '9px 22px 15px',
                fontSize: 36,
                lineHeight: 1,
              }}
            >
              💚 CHOISIT SA PRÉFÉRÉE
            </div>
          </div>
        </Appear>
        <div style={{ height: 55 }} />
        <div style={{ display: 'grid', gridTemplateColumns: '470px 470px', gap: 30 }}>
          {PLAYED.map((c, i) => {
            const picked = i === PICKED && frame >= PICK_AT;
            const rot = i % 2 === 0 ? -1.5 : 1.5;
            return (
              <div key={c.t} style={{ position: 'relative' }}>
                <Appear delay={8 + i * 4}>
                  <div
                    style={{
                      ...anton,
                      position: 'relative',
                      width: 470,
                      height: 240,
                      backgroundColor: picked ? '#fff' : '#33333a',
                      color: picked ? '#000' : '#c9c9d2',
                      border: picked ? `9px solid ${PINK}` : '9px solid #55555f',
                      boxShadow: picked ? `0 0 0 7px ${PINK}, 0 0 65px ${PINK}` : 'none',
                      transform: picked ? `scale(1.07) rotate(${rot}deg)` : `rotate(${rot}deg)`,
                      opacity: picked ? 1 : 0.82,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      fontSize: 46,
                      lineHeight: 0.95,
                      padding: '36px 26px 26px',
                    }}
                  >
                    <CardBadge emoji={c.e} dim={!picked} />
                    {c.t}
                  </div>
                </Appear>
                {i === PICKED && <TapRing delay={PICK_AT - 4} />}
              </div>
            );
          })}
        </div>
      </Center>
    </AbsoluteFill>
  );
};

// ---------- 4. Ecran RESULTAT classique ----------

const SceneResult = () => (
  <AbsoluteFill style={{ backgroundColor: YELLOW }}>
    <GameChrome right="" />
    <Center style={{ paddingTop: 190 }}>
      <Appear delay={0}>
        <div style={{ ...anton, fontSize: 36, opacity: 0.6, textAlign: 'center' }}>
          CARTE CHOISIE
        </div>
      </Appear>
      <div style={{ height: 28 }} />
      <Stamp delay={5} from={1.6}>
        <div
          style={{
            ...anton,
            position: 'relative',
            width: 700,
            backgroundColor: '#000',
            color: YELLOW,
            boxShadow: '16px 16px 0 #000',
            transform: 'rotate(-2deg)',
            padding: '64px 46px',
            fontSize: 84,
            lineHeight: 0.95,
            textAlign: 'center',
          }}
        >
          <CardBadge emoji="🍻" />
          APPELER TON EX
        </div>
      </Stamp>
      <div style={{ height: 50 }} />
      <Appear delay={28}>
        <div style={{ ...anton, fontSize: 36, opacity: 0.6, textAlign: 'center' }}>POSÉE PAR</div>
      </Appear>
      <div style={{ height: 18 }} />
      <Stamp delay={34} from={2}>
        <div
          style={{
            ...anton,
            fontSize: 145,
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
      <div style={{ height: 50 }} />
      <Stamp delay={55} from={3}>
        <Chip text="+1 POINT" bg="#000" color={YELLOW} tilt={3} fontSize={76} />
      </Stamp>
    </Center>
  </AbsoluteFill>
);

// ---------- 5. Ecran PLAY apero : 7 cartes + mise de gorgees ----------

const A_TAP_CARD = 45;
const A_TAP_BET = 90;
const A_PRESS = 135;

const SceneAperoPlay = () => {
  const frame = useCurrentFrame();
  const betOn = frame >= A_TAP_BET + 4;
  return (
    <AbsoluteFill>
      <Img
        src={staticFile('apero-bg.webp')}
        style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <GameChrome right="🍻 APÉRO" bg={AMBER} vip="SARAH" />
      <Center style={{ paddingTop: 175, paddingBottom: 300 }}>
        <Appear delay={0}>
          <ModeBanner name="SARAH" color={SARAH} like />
        </Appear>
        <div style={{ height: 34 }} />
        <HandGrid selectedIdx={0} tapAt={A_TAP_CARD} />
      </Center>
      <BottomBar bg={AMBER}>
        <div style={{ display: 'flex', gap: 26 }}>
          {[1, 2, 3, 4].map((n, i) => {
            const on = i === 2 && betOn;
            return (
              <div key={n} style={{ position: 'relative' }}>
                <div
                  style={{
                    ...anton,
                    width: 132,
                    height: 108,
                    backgroundColor: on ? PINK : '#fff',
                    color: on ? '#fff' : '#000',
                    border: '9px solid #000',
                    boxShadow: on ? '11px 11px 0 #000' : '5px 5px 0 #000',
                    transform: on ? 'translate(-4px,-4px)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 62,
                    lineHeight: 1,
                  }}
                >
                  {n}
                </div>
                {i === 2 && <TapRing delay={A_TAP_BET} />}
              </div>
            );
          })}
        </div>
        <PlayButton
          label={betOn ? 'JOUER · MISE 3 🍺' : 'MISE TES GORGÉES (1-4)'}
          pressed={frame >= A_PRESS}
        />
      </BottomBar>
    </AbsoluteFill>
  );
};

// ---------- 6. Ecran RESULTAT apero ----------

const SceneAperoResult = () => (
  <AbsoluteFill>
    <Img
      src={staticFile('apero-bg.webp')}
      style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
    />
    <GameChrome right="🍻 APÉRO" bg={AMBER} vip="SARAH" />
    <Center style={{ paddingTop: 190 }}>
      <Appear delay={0}>
        <div style={{ ...anton, fontSize: 36, opacity: 0.6, textAlign: 'center' }}>
          CARTE CHOISIE
        </div>
      </Appear>
      <div style={{ height: 28 }} />
      <Stamp delay={5} from={1.6}>
        <div
          style={{
            ...anton,
            position: 'relative',
            width: 720,
            backgroundColor: '#000',
            color: YELLOW,
            boxShadow: '16px 16px 0 #000',
            transform: 'rotate(-2deg)',
            padding: '64px 46px',
            fontSize: 80,
            lineHeight: 0.95,
            textAlign: 'center',
          }}
        >
          <CardBadge emoji="🍕" />
          PIZZA ANANAS
        </div>
      </Stamp>
      <div style={{ height: 45 }} />
      <Appear delay={26}>
        <div style={{ ...anton, fontSize: 36, opacity: 0.6, textAlign: 'center' }}>POSÉE PAR</div>
      </Appear>
      <div style={{ height: 16 }} />
      <Stamp delay={32} from={2}>
        <div
          style={{
            ...anton,
            fontSize: 125,
            lineHeight: 1,
            color: MAX,
            WebkitTextStroke: '9px #000',
            paintOrder: 'stroke fill',
            letterSpacing: '0.06em',
          }}
        >
          MAX
        </div>
      </Stamp>
      <div style={{ height: 50 }} />
      <Stamp delay={52} from={3.2}>
        <Chip text="TOUT LE MONDE BOIT 3" bg={PINK} tilt={3} fontSize={68} />
      </Stamp>
      <div style={{ height: 32 }} />
      <Appear delay={75}>
        <div style={{ ...anton, fontSize: 32, opacity: 0.65, textAlign: 'center' }}>
          LE GAGNANT NE BOIT PAS 😎
        </div>
      </Appear>
    </Center>
  </AbsoluteFill>
);

// ---------- 7. Pitch + 8. Fin ----------

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

const SceneEnd = () => (
  <Center>
    <Stamp from={1.8}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ ...anton, fontSize: 160, lineHeight: 0.85 }}>SNAP</div>
        <div
          style={{
            ...anton,
            fontSize: 92,
            lineHeight: 1,
            color: '#fff',
            backgroundColor: PINK,
            border: '9px solid #000',
            boxShadow: '12px 12px 0 #000',
            padding: '8px 40px 15px',
            transform: 'rotate(-3deg)',
            marginTop: 8,
          }}
        >
          TAP
        </div>
      </div>
    </Stamp>
    <div style={{ height: 70 }} />
    <Stamp delay={14} from={1.8}>
      <div
        style={{
          backgroundColor: '#fff',
          border: '12px solid #000',
          boxShadow: '16px 16px 0 #000',
          padding: 26,
          transform: 'rotate(-2deg)',
        }}
      >
        <Img src={staticFile('qr.png')} style={{ width: 360, height: 360, display: 'block' }} />
      </div>
    </Stamp>
    <div style={{ height: 70 }} />
    <Stamp delay={28}>
      <div style={{ ...anton, fontSize: 72 }}>SCANNE. JOUE.</div>
    </Stamp>
    <div style={{ height: 26 }} />
    <Stamp delay={40}>
      <div style={{ ...anton, fontSize: 54 }}>SNAPTAPPARTY.COM</div>
    </Stamp>
  </Center>
);

// ---------- Composition ----------
// Intertitre → ecran, pour chaque etape : on comprend sans reflechir.

export const Promo = () => (
  <AbsoluteFill style={{ backgroundColor: YELLOW }}>
    <Sequence from={0} durationInFrames={70}>
      <SceneLogo />
    </Sequence>
    <Sequence from={70} durationInFrames={160}>
      <ScenePlay />
    </Sequence>
    <Sequence from={230} durationInFrames={100}>
      <SceneReveal />
    </Sequence>
    <Sequence from={330} durationInFrames={90}>
      <SceneResult />
    </Sequence>
    <Sequence from={420} durationInFrames={55}>
      <Intertitle lines={['ET EN', 'MODE APÉRO ?']} emoji="🍻" />
    </Sequence>
    <Sequence from={475} durationInFrames={165}>
      <SceneAperoPlay />
    </Sequence>
    <Sequence from={640} durationInFrames={95}>
      <SceneAperoResult />
    </Sequence>
    <Sequence from={735} durationInFrames={75}>
      <ScenePitch />
    </Sequence>
    <Sequence from={810} durationInFrames={115}>
      <SceneEnd />
    </Sequence>
  </AbsoluteFill>
);
