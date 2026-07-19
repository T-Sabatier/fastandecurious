// Video de presentation Snap Tap (~31 s, 1080x1920) — simulation d'une vraie
// partie (ecrans copies de Game.jsx) rendue VIVANTE et GOOFY : wiggle
// permanent, secousses d'ecran aux moments forts, explosions d'emojis,
// pluie de bieres. Pas de son integre (musique ajoutee dans TikTok/IG).
//
// REGLE EDITORIALE : cartes generiques courtes (1-2 mots), lisibles en un
// coup d'oeil ; pas de coquin (video tous publics).
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
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

// ================= ANIMATIONS DE BASE =================

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

// ================= ANIMATIONS GOOFY =================

// Balancement continu : l'element est "vivant".
const Wiggle = ({ children, amp = 2, speed = 10, phase = 0 }) => {
  const frame = useCurrentFrame();
  const r = Math.sin(frame / speed + phase) * amp;
  return <div style={{ transform: `rotate(${r}deg)` }}>{children}</div>;
};

// Petit rebond continu (pour les mots importants).
const Bounce = ({ children, delay = 0, amp = 14, speed = 7 }) => {
  const frame = useCurrentFrame();
  const t = Math.max(0, frame - delay);
  const y = -Math.abs(Math.sin(t / speed)) * amp;
  return <div style={{ transform: `translateY(${y}px)` }}>{children}</div>;
};

// Secousse d'ecran (impact) : a utiliser sur le transform du fond de scene.
const useShake = (at, dur = 12, power = 12) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > dur) return '';
  const decay = 1 - t / dur;
  const dx = Math.sin(t * 2.7) * power * decay;
  const dy = Math.cos(t * 3.3) * power * 0.6 * decay;
  return ` translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
};

// Punch d'entree de scene (mini zoom qui se pose) : rythme de montage.
const usePunch = () => {
  const frame = useCurrentFrame();
  const s = interpolate(frame, [0, 9], [1.06, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  return `scale(${s})`;
};

// Explosion d'emojis (victoire, moment fort). Deterministe (pas de random).
const EmojiBurst = ({ emojis = ['🎉'], delay = 0, count = 12, dist = 420, size = 70, x = '50%', y = '45%' }) => {
  const frame = useCurrentFrame();
  const t = frame - delay;
  if (t < 0 || t > 52) return null;
  const prog = interpolate(t, [0, 46], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const opacity = interpolate(t, [30, 50], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div style={{ position: 'absolute', left: x, top: y, zIndex: 20 }}>
      {Array.from({ length: count }).map((_, i) => {
        const ang = (i / count) * Math.PI * 2 + i * 0.7;
        const d = dist * (0.7 + ((i * 37) % 10) / 25) * prog;
        const ex = Math.cos(ang) * d;
        const ey = Math.sin(ang) * d * 0.8 + prog * prog * 140;
        const rot = (((i * 53) % 90) - 45) * prog;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              transform: `translate(${ex.toFixed(1)}px, ${ey.toFixed(1)}px) rotate(${rot.toFixed(1)}deg) scale(${(0.5 + prog).toFixed(2)})`,
              fontSize: size,
              opacity,
              lineHeight: 1,
            }}
          >
            {emojis[i % emojis.length]}
          </div>
        );
      })}
    </div>
  );
};

// Pluie d'emojis (🍺 sur "tout le monde boit").
const EmojiRain = ({ emoji = '🍺', delay = 0, count = 10, size = 78 }) => {
  const frame = useCurrentFrame();
  const t = frame - delay;
  if (t < 0) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 20, overflow: 'hidden', pointerEvents: 'none' }}>
      {Array.from({ length: count }).map((_, i) => {
        const stagger = (i * 9) % 26;
        const tt = t - stagger;
        if (tt < 0) return null;
        const yy = -140 + tt * 30;
        if (yy > 2000) return null;
        const xx = ((i * 127) % 100) * 0.88 + 4;
        const rot = Math.sin((tt + i * 3) / 6) * 28;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${xx}%`,
              top: yy,
              fontSize: size,
              transform: `rotate(${rot.toFixed(1)}deg)`,
              lineHeight: 1,
            }}
          >
            {emoji}
          </div>
        );
      })}
    </div>
  );
};

// Emojis flottants en fond (ecrans jaunes uniquement, discret).
const FloatingEmojis = ({ emojis = ['🍕', '🍻', '🤪', '❤️', '🎉', '✈️'], opacity = 0.18, size = 92 }) => {
  const frame = useCurrentFrame();
  const POS = [
    [7, 13],
    [79, 9],
    [12, 79],
    [82, 73],
    [6, 45],
    [86, 43],
  ];
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {POS.map(([px, py], i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${px}%`,
            top: `${py}%`,
            fontSize: size,
            opacity,
            transform: `translateY(${(Math.sin(frame / 18 + i * 1.7) * 24).toFixed(1)}px) rotate(${(Math.sin(frame / 25 + i) * 12).toFixed(1)}deg)`,
            lineHeight: 1,
          }}
        >
          {emojis[i % emojis.length]}
        </div>
      ))}
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

// ================= HABILLAGE DE PARTIE =================

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
      {PLAYERS.map((p, i) => (
        <Wiggle key={p.n} amp={1.4} speed={12} phase={i * 1.3}>
          <div
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
        </Wiggle>
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

// Oeil filaire du jeu (icone lucide Eye), dans la couleur du mode.
const EyeIcon = ({ color, size = 64 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const Intertitle = ({ lines, emoji }) => (
  <AbsoluteFill style={{ backgroundColor: '#000' }}>
    <Center>
      <Stamp from={2.2}>
        <Wiggle amp={1.6} speed={9}>
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
        </Wiggle>
      </Stamp>
      {emoji && (
        <>
          <div style={{ height: 45 }} />
          <Stamp delay={12} from={3}>
            <Wiggle amp={9} speed={5}>
              <div style={{ fontSize: 130, lineHeight: 1 }}>{emoji}</div>
            </Wiggle>
          </Stamp>
        </>
      )}
    </Center>
  </AbsoluteFill>
);

// ================= CARTES =================

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

// PUB = LECTURE ECLAIR : cartes 1-2 mots (2 exceptions max).
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
            <Wiggle amp={1.2} speed={11} phase={i * 1.1}>
              <SmallCard
                text={c.t}
                emoji={c.e}
                selected={i === selectedIdx && frame >= tapAt + 4}
              />
            </Wiggle>
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

// ================= SCENES =================

// ---------- 1. Logo ----------

const SceneLogo = () => (
  <AbsoluteFill style={{ backgroundColor: YELLOW }}>
    <Center>
      <Stamp from={3.2}>
        <Wiggle amp={1.3} speed={13}>
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
        </Wiggle>
      </Stamp>
      <div style={{ height: 90 }} />
      <Stamp delay={22}>
        <Wiggle amp={2.5} speed={8} phase={2}>
          <Chip text="LE JEU D'APÉRO" bg="#000" color={YELLOW} tilt={-2} />
        </Wiggle>
      </Stamp>
    </Center>
  </AbsoluteFill>
);

// ---------- 2. Ecran PLAY : 7 cartes, tap, jouer ----------

const TAP_AT = 70;
const PRESS_AT = 115;
const SELECTED = 3; // RACLETTE

const ScenePlay = () => {
  const frame = useCurrentFrame();
  const selected = frame >= TAP_AT + 4;
  const punch = usePunch();
  return (
    <AbsoluteFill style={{ backgroundColor: YELLOW, transform: punch }}>
      <GameChrome right="0/4 POSÉ" />
      <Center style={{ paddingTop: 175, paddingBottom: 175 }}>
        <Appear delay={0}>
          <Wiggle amp={1.8} speed={9}>
            <ModeBanner name="LÉA" color={LEA} like />
          </Wiggle>
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

// ---------- 3. Mode PROJECTEUR : Lea choisit ----------

const PICK_AT = 55;
const PLAYED = [
  { t: 'SIESTE', e: '☕' },
  { t: 'RACLETTE', e: '🍕' },
  { t: 'MARIAGE', e: '❤️' },
  { t: 'PASTIS', e: '🥤' },
];
const PICKED = 1;

const SceneReveal = () => {
  const frame = useCurrentFrame();
  const punch = usePunch();
  const shake = useShake(PICK_AT, 14, 16);
  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a', transform: punch + shake }}>
      <GameChrome right="4 CARTES" />
      <EmojiBurst emojis={['💚', '🍕', '🧀']} delay={PICK_AT + 2} x="72%" y="52%" />
      <Center style={{ paddingTop: 190 }}>
        <Appear delay={0}>
          <div style={{ textAlign: 'center' }}>
            <Bounce amp={8} speed={9}>
              <div style={{ marginBottom: 18 }}>
                <EyeIcon color={LIKE_GREEN} />
              </div>
            </Bounce>
            <Wiggle amp={1.5} speed={10}>
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
            </Wiggle>
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
                  <Wiggle amp={picked ? 2.2 : 1} speed={picked ? 7 : 12} phase={i}>
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
                        transform: picked
                          ? `scale(1.07) rotate(${rot}deg)`
                          : `rotate(${rot}deg)`,
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
                  </Wiggle>
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

// ---------- 4. Ecran RESULTAT ----------

const SceneResult = () => {
  const punch = usePunch();
  const shake = useShake(55, 12, 12);
  return (
    <AbsoluteFill style={{ backgroundColor: YELLOW, transform: punch + shake }}>
      <GameChrome right="" />
      <EmojiBurst emojis={['🎉', '🎊', '✨']} delay={40} count={14} x="50%" y="52%" />
      <Center style={{ paddingTop: 190 }}>
        <Appear delay={0}>
          <div style={{ ...anton, fontSize: 36, opacity: 0.6, textAlign: 'center' }}>
            CARTE CHOISIE
          </div>
        </Appear>
        <div style={{ height: 28 }} />
        <Stamp delay={5} from={1.6}>
          <Wiggle amp={1.6} speed={10}>
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
              <CardBadge emoji="🍕" />
              RACLETTE
            </div>
          </Wiggle>
        </Stamp>
        <div style={{ height: 50 }} />
        <Appear delay={28}>
          <div style={{ ...anton, fontSize: 36, opacity: 0.6, textAlign: 'center' }}>
            POSÉE PAR
          </div>
        </Appear>
        <div style={{ height: 18 }} />
        <Stamp delay={34} from={2}>
          <Bounce delay={34} amp={16} speed={8}>
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
          </Bounce>
        </Stamp>
        <div style={{ height: 50 }} />
        <Stamp delay={55} from={3}>
          <Wiggle amp={2.5} speed={8}>
            <Chip text="+1 POINT" bg="#000" color={YELLOW} tilt={3} fontSize={76} />
          </Wiggle>
        </Stamp>
      </Center>
    </AbsoluteFill>
  );
};

// ---------- 5. Ecran PLAY apero : mise de gorgees ----------

const A_TAP_CARD = 45;
const A_TAP_BET = 90;
const A_PRESS = 135;

const SceneAperoPlay = () => {
  const frame = useCurrentFrame();
  const betOn = frame >= A_TAP_BET + 4;
  const punch = usePunch();
  return (
    <AbsoluteFill style={{ transform: punch }}>
      <Img
        src={staticFile('apero-bg.webp')}
        style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <GameChrome right="🍻 APÉRO" bg={AMBER} vip="SARAH" />
      <Center style={{ paddingTop: 175, paddingBottom: 300 }}>
        <Appear delay={0}>
          <Wiggle amp={1.8} speed={9}>
            <ModeBanner name="SARAH" color={SARAH} like />
          </Wiggle>
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
                <Wiggle amp={on ? 3 : 1.3} speed={on ? 6 : 11} phase={i * 1.4}>
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
                </Wiggle>
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

const SceneAperoResult = () => {
  const punch = usePunch();
  const shake = useShake(52, 14, 15);
  return (
    <AbsoluteFill style={{ transform: punch + shake }}>
      <Img
        src={staticFile('apero-bg.webp')}
        style={{ position: 'absolute', width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <GameChrome right="🍻 APÉRO" bg={AMBER} vip="SARAH" />
      <EmojiRain emoji="🍺" delay={52} />
      <Center style={{ paddingTop: 190 }}>
        <Appear delay={0}>
          <div style={{ ...anton, fontSize: 36, opacity: 0.6, textAlign: 'center' }}>
            CARTE CHOISIE
          </div>
        </Appear>
        <div style={{ height: 28 }} />
        <Stamp delay={5} from={1.6}>
          <Wiggle amp={1.6} speed={10}>
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
          </Wiggle>
        </Stamp>
        <div style={{ height: 45 }} />
        <Appear delay={26}>
          <div style={{ ...anton, fontSize: 36, opacity: 0.6, textAlign: 'center' }}>
            POSÉE PAR
          </div>
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
          <Wiggle amp={2.8} speed={7}>
            <Chip text="TOUT LE MONDE BOIT 3" bg={PINK} tilt={3} fontSize={68} />
          </Wiggle>
        </Stamp>
        <div style={{ height: 32 }} />
        <Appear delay={75}>
          <Bounce delay={75} amp={8} speed={8}>
            <div style={{ ...anton, fontSize: 32, opacity: 0.65, textAlign: 'center' }}>
              LE GAGNANT NE BOIT PAS 😎
            </div>
          </Bounce>
        </Appear>
      </Center>
    </AbsoluteFill>
  );
};

// ---------- 7. Pitch + 8. Fin ----------

const ScenePitch = () => (
  <AbsoluteFill style={{ backgroundColor: YELLOW }}>
    <Center>
      <Stamp delay={0}>
        <Wiggle amp={2} speed={9}>
          <Chip text="3 À 16 JOUEURS" bg="#000" color={YELLOW} tilt={-2} fontSize={78} />
        </Wiggle>
      </Stamp>
      <div style={{ height: 70 }} />
      <Stamp delay={20}>
        <Wiggle amp={2} speed={9} phase={2}>
          <Chip text="CHACUN SUR SON TEL" bg="#fff" color="#000" tilt={2} fontSize={78} />
        </Wiggle>
      </Stamp>
      <div style={{ height: 70 }} />
      <Stamp delay={40} from={3.4}>
        <Bounce delay={40} amp={18} speed={8}>
          <Chip text="GRATUIT" bg={PINK} tilt={-3} fontSize={120} />
        </Bounce>
      </Stamp>
    </Center>
  </AbsoluteFill>
);

const SceneEnd = () => (
  <AbsoluteFill style={{ backgroundColor: YELLOW }}>
    <Center>
      <Stamp from={1.8}>
        <Wiggle amp={1.4} speed={12}>
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
        </Wiggle>
      </Stamp>
      <div style={{ height: 80 }} />
      <Stamp delay={16} from={2}>
        <Wiggle amp={1.4} speed={11}>
          <div
            style={{
              ...anton,
              backgroundColor: '#000',
              color: YELLOW,
              boxShadow: '14px 14px 0 #000',
              padding: '26px 46px 36px',
              fontSize: 66,
              lineHeight: 1,
              transform: 'rotate(-1.5deg)',
            }}
          >
            SNAPTAPPARTY.COM
          </div>
        </Wiggle>
      </Stamp>
      <div style={{ height: 60 }} />
      <Stamp delay={32} from={3}>
        <Bounce delay={32} amp={14} speed={8}>
          <Chip text="LIEN EN BIO 👇" bg={PINK} tilt={2} fontSize={72} />
        </Bounce>
      </Stamp>
      <div style={{ height: 45 }} />
      <Appear delay={50}>
        <div style={{ ...anton, fontSize: 40, opacity: 0.7 }}>GRATUIT · SANS COMPTE</div>
      </Appear>
    </Center>
  </AbsoluteFill>
);

// ================= COMPOSITION =================

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
