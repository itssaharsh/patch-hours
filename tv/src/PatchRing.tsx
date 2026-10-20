import React from 'react';
import {StyleSheet, View} from 'react-native';
import {C} from './theme';

// Today's minutes drawn as an adhesive eye patch filling with tan; a corner peels when the patch is off.
export const PatchRing = ({minutes, prescribed, off}: {minutes: number; prescribed: number; off: boolean}) => {
  const frac = Math.max(0, Math.min(1, minutes / Math.max(1, prescribed)));
  return (
    <View style={styles.wrap}>
      <View style={styles.patch}>
        <View style={[styles.fill, {height: `${frac * 100}%`}]} />
        <View style={styles.pad} />
      </View>
      {off && <View style={styles.peel} />}
    </View>
  );
};

const W = 180;
const H = 124;
const styles = StyleSheet.create({
  wrap: {width: W + 20, height: H + 30, alignItems: 'center', justifyContent: 'center'},
  patch: {
    width: W,
    height: H,
    borderRadius: H / 2,
    backgroundColor: C.surface2,
    borderWidth: 2,
    borderColor: C.lineInput,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {width: '100%', backgroundColor: C.patch},
  pad: {
    position: 'absolute',
    left: W * 0.18,
    top: H * 0.2,
    width: W * 0.62,
    height: H * 0.56,
    borderRadius: H * 0.3,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(29,23,20,0.22)',
  },
  peel: {
    position: 'absolute',
    right: 2,
    top: 4,
    width: 38,
    height: 24,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 22,
    backgroundColor: C.off,
    transform: [{rotate: '-28deg'}],
  },
});
