import { useRef } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  step: number;
  longPressStep: number;
  min?: number;
  max?: number;
  label: string;
  decimals?: number;
}

export function NumberStepper({
  value,
  onChange,
  step,
  longPressStep,
  min = 0,
  max = 9999,
  label,
  decimals = 0,
}: NumberStepperProps) {
  const longPressActiveRef = useRef(false);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const handleDecrement = () => onChange(clamp(parseFloat((value - step).toFixed(decimals))));
  const handleIncrement = () => onChange(clamp(parseFloat((value + step).toFixed(decimals))));
  const handleLongDecrement = () => {
    longPressActiveRef.current = true;
    onChange(clamp(parseFloat((value - longPressStep).toFixed(decimals))));
  };
  const handleLongIncrement = () => {
    longPressActiveRef.current = true;
    onChange(clamp(parseFloat((value + longPressStep).toFixed(decimals))));
  };

  const display = decimals > 0 ? value.toFixed(decimals) : String(value);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.btn}
          onPress={handleDecrement}
          onLongPress={handleLongDecrement}
          delayLongPress={400}
          testID={`stepper-dec-${label}`}
          hitSlop={4}
        >
          <Text style={styles.btnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.value} testID={`stepper-value-${label}`}>
          {display}
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={handleIncrement}
          onLongPress={handleLongIncrement}
          delayLongPress={400}
          testID={`stepper-inc-${label}`}
          hitSlop={4}
        >
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 4 },
  label: { color: '#888', fontSize: 12, fontWeight: '500', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1e1e1e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  btnText: { color: '#f5f5f5', fontSize: 22, fontWeight: '300', lineHeight: 26 },
  value: {
    width: 72,
    textAlign: 'center',
    color: '#f5f5f5',
    fontSize: 22,
    fontWeight: '600',
  },
});
