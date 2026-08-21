import { StyleSheet, TextInput, View, Text } from 'react-native';
import type { TextInputProps } from 'react-native';

interface TextAreaProps extends Omit<TextInputProps, 'multiline' | 'numberOfLines'> {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  numberOfLines?: number;
  trailing?: React.ReactNode;
}

export function TextArea({ label, placeholder, value, onChangeText, error, numberOfLines = 4, trailing, ...props }: TextAreaProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            error && styles.inputError,
            trailing ? styles.inputWithTrailing : null,
          ].filter(Boolean) as any}
          multiline
          numberOfLines={numberOfLines}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={value}
          onChangeText={onChangeText}
          {...props}
        />
        {trailing && (
          <View style={styles.trailingContainer}>
            {trailing}
          </View>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderColor: '#d1d9e2',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    textAlignVertical: 'top',
    minHeight: 80,
  },
  inputWithTrailing: {
    paddingRight: 8,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  trailingContainer: {
    paddingRight: 12,
    paddingBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 6,
  },
});