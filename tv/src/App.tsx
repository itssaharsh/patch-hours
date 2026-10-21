import React, {useEffect, useRef, useState} from 'react';
import {Dimensions, Image, StyleSheet, Text, View} from 'react-native';
import {Video} from '@amazon-devices/react-native-w3cmedia';
import {PatchRing} from './PatchRing';
import {useTvSession} from './session';
import {API, SHOW_PLAYER_CLOCK, VIDEO_CREDIT, VIDEO_URL} from './config';
import {C} from './theme';

type Phase =
  | 'pairing'
  | 'playing'
  | 'paused-off'
  | 'paused-stale'
  | 'paused-covered';

function fmt(min: number) {
  if (min >= 10) {
    return String(Math.floor(min));
  }
  const s = Math.floor(min * 60);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const App = () => {
  const {code, view, error, lastOk} = useTvSession();
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // No successful poll for 4 s: the TV can't know the patch is on, so it pauses.
  const offline = !!view && now - lastOk > 4000;
  const video = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [pauseNote, setPauseNote] = useState('');
  const [media, setMedia] = useState('');
  const wasPlaying = useRef(false);

  const phase: Phase = !view?.paired
    ? 'pairing'
    : view.playable && !offline
    ? 'playing'
    : view.stale || offline
    ? 'paused-stale'
    : view.flag.cls === 'covered'
    ? 'paused-covered'
    : 'paused-off';

  // Give the player its source once.
  useEffect(() => {
    if (video.current && !ready) {
      const v = video.current;
      (SHOW_PLAYER_CLOCK
        ? [
            'loadedmetadata',
            'playing',
            'pause',
            'error',
            'waiting',
            'canplay',
            'timeupdate',
          ]
        : []
      ).forEach((ev) =>
        v.addEventListener(ev, () =>
          setMedia(
            `${ev} ${
              v.error
                ? 'err ' + v.error.code + ' ' + (v.error.message ?? '')
                : ''
            } t=${Math.round(v.currentTime ?? 0)} src=${String(
              v.currentSrc ?? v.src,
            ).slice(0, 60)}`,
          ),
        ),
      );
      v.src = VIDEO_URL;
      v.loop = true;
      setReady(true);
    }
  }, [ready]);

  // Play or pause the reward strictly by the session state, only when the state changes.
  const lastPhase = useRef<Phase | null>(null);
  useEffect(() => {
    const v = video.current;
    if (!v || !ready || lastPhase.current === phase) {
      return;
    }
    lastPhase.current = phase;
    if (phase === 'playing') {
      v.play();
      setPauseNote('');
    } else {
      v.pause();
      if (wasPlaying.current && view && view.changedAt) {
        const s = Math.max(0, (view.serverNow - view.changedAt) / 1000);
        setPauseNote(
          phase === 'paused-stale'
            ? 'Paused: the phone stopped reporting'
            : `Paused ${s.toFixed(1)} s after the patch came off`,
        );
      }
    }
    wasPlaying.current = phase === 'playing';
  }, [phase, ready, view]);

  // Debug line: the player's clock, read once a second.
  useEffect(() => {
    if (!SHOW_PLAYER_CLOCK) {
      return;
    }
    const t = setInterval(() => {
      const v = video.current;
      if (v) {
        setMedia((m) =>
          m.replace(/t=\d+/, `t=${Math.round(v.currentTime ?? 0)}`),
        );
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const minutes = (view?.today.verifiedSec ?? 0) / 60;
  const prescribed = view?.prescribedMin ?? 120;
  const off = phase !== 'playing' && phase !== 'pairing';

  // Video draws on a plane under the UI, so the stage is a transparent window and the
  // canvas colour is painted around it in bands.
  const {width: W, height: H} = Dimensions.get('window');
  const stageW = W - PAD - GAP - RAIL_W - PAD;
  const stageH = (stageW * 9) / 16;
  const bandV = Math.max(0, (H - stageH) / 2);

  return (
    <View style={styles.root}>
      <View style={styles.left}>
        <View style={[styles.band, {height: bandV}]} />
        <View style={[styles.row, {height: stageH}]}>
          <View style={[styles.band, {width: PAD}]} />
          <View style={[styles.stage, {width: stageW, height: stageH}]}>
            <Video
              ref={(r: any) => {
                video.current = r;
              }}
              style={styles.video}
            />
            {phase !== 'playing' && (
              <View
                style={[
                  styles.scrim,
                  phase === 'pairing' ? styles.scrimDeep : null,
                ]}
              />
            )}
            {phase === 'pairing' && (
              <View style={styles.overlay}>
                <Text style={styles.pairTitle}>Pair a phone to start</Text>
                <View style={styles.pairRow}>
                  {code ? (
                    <Image
                      source={{uri: `${API}/api/qr?code=${code}`}}
                      style={styles.qr}
                    />
                  ) : (
                    <View style={styles.qr} />
                  )}
                  <View style={styles.pairText}>
                    <Text style={styles.label}>Code</Text>
                    <Text style={styles.code} numberOfLines={1}>{code ?? '······'}</Text>
                    <Text style={styles.muted}>
                      Scan with the phone that will watch the patch.
                    </Text>
                  </View>
                </View>
              </View>
            )}
            {off && (
              <View style={styles.overlay}>
                <Text style={styles.prompt}>
                  {phase === 'paused-stale'
                    ? 'The phone can’t see the patch'
                    : phase === 'paused-covered'
                    ? 'That’s a hand, not the patch'
                    : 'Patch back on to keep watching'}
                </Text>
                {pauseNote !== '' && (
                  <Text style={styles.note}>{pauseNote}</Text>
                )}
              </View>
            )}
          </View>
          <View style={[styles.band, {width: GAP}]} />
        </View>
        <View style={[styles.band, {flex: 1}]} />
      </View>
      <View style={styles.rail}>
        <Text style={styles.brand}>Patch Hours</Text>
        <PatchRing minutes={minutes} prescribed={prescribed} off={off} />
        <Text style={styles.minutes}>
          {fmt(minutes)}{' '}
          <Text style={styles.of}>of {prescribed} min today</Text>
        </Text>
        <View style={styles.chip}>
          <View
            style={[
              styles.dot,
              {backgroundColor: phase === 'playing' ? C.patch : C.off},
            ]}
          />
          <Text
            style={[
              styles.chipText,
              {color: phase === 'playing' ? C.patch : C.off},
            ]}>
            {phase === 'pairing'
              ? 'Waiting for the phone'
              : phase === 'playing'
              ? 'Patch on'
              : phase === 'paused-stale'
              ? 'Phone not reporting'
              : 'Patch off'}
          </Text>
        </View>
        {error && (
          <Text style={styles.err}>
            Can&apos;t reach Patch Hours. Retrying…
          </Text>
        )}
        {view?.simulated && (
          <Text style={styles.sim}>Scripted run, not a camera</Text>
        )}
        <Text style={styles.credit}>{VIDEO_CREDIT}</Text>
        {SHOW_PLAYER_CLOCK && media !== '' && (
          <Text style={styles.media}>{media}</Text>
        )}
      </View>
    </View>
  );
};

const PAD = 20;
const GAP = 20;
const RAIL_W = 220;

const styles = StyleSheet.create({
  root: {flex: 1, flexDirection: 'row', backgroundColor: 'transparent'},
  left: {flexDirection: 'column'},
  row: {flexDirection: 'row'},
  band: {backgroundColor: C.canvas},
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(29,23,20,0.72)',
  },
  scrimDeep: {backgroundColor: 'rgba(29,23,20,0.88)'},
  stage: {overflow: 'hidden', backgroundColor: 'transparent'},
  video: {width: '100%', height: '100%'},
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  pairTitle: {color: C.ink, fontSize: 32, fontWeight: '800', marginBottom: 20},
  pairRow: {flexDirection: 'row', alignItems: 'center', gap: 24},
  qr: {width: 140, height: 140, borderRadius: 8, backgroundColor: C.surface2},
  pairText: {maxWidth: 340},
  label: {color: C.inkMuted, fontSize: 14},
  code: {color: C.accent, fontSize: 54, fontWeight: '800', letterSpacing: 3},
  muted: {color: C.inkMuted, fontSize: 13},
  prompt: {color: C.ink, fontSize: 38, fontWeight: '800', textAlign: 'center'},
  note: {color: C.accent, fontSize: 15, marginTop: 10},
  rail: {
    width: RAIL_W + PAD,
    paddingRight: PAD,
    backgroundColor: C.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  brand: {color: C.accent, fontSize: 22, fontWeight: '800'},
  minutes: {color: C.ink, fontSize: 32, fontWeight: '800'},
  of: {color: C.inkMuted, fontSize: 13, fontWeight: '600'},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.surface1,
    borderRadius: 499.5,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  dot: {width: 8, height: 8, borderRadius: 4},
  chipText: {fontSize: 14, fontWeight: '600'},
  media: {
    color: C.inkMuted,
    fontSize: 9,
    position: 'absolute',
    bottom: 20,
    width: 220,
  },
  sim: {color: C.accent, fontSize: 12},
  err: {color: C.off, fontSize: 11},
  credit: {color: C.inkMuted, fontSize: 10, position: 'absolute', bottom: 4},
});
