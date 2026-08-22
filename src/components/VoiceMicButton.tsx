import { useEffect, useState, useRef, useCallback } from 'react';
import { StyleSheet, Pressable, View, Alert, Platform } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

// Safely check for native module to prevent crash in Expo Go
const isNativeModuleAvailable = !!ExpoSpeechRecognitionModule;

interface VoiceMicButtonProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export function VoiceMicButton({ onTranscription, disabled = false }: VoiceMicButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [nativeModuleAvailable, setNativeModuleAvailable] = useState(isNativeModuleAvailable);
  const listenerRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    checkPermission();
    checkNativeModule();
  }, []);

  const checkNativeModule = () => {
    if (!isNativeModuleAvailable) {
      setNativeModuleAvailable(false);
      return;
    }
    try {
      if (!ExpoSpeechRecognitionModule.start) {
        setNativeModuleAvailable(false);
      }
    } catch {
      setNativeModuleAvailable(false);
    }
  };

  const checkPermission = async () => {
    if (!nativeModuleAvailable) return;
    try {
      const permission = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      setHasPermission(permission.granted);
    } catch (error) {
      console.error('Failed to check speech recognition permission:', error);
      setHasPermission(false);
    }
  };

  const requestPermission = async () => {
    if (!nativeModuleAvailable) return false;
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setHasPermission(permission.granted);
      return permission.granted;
    } catch (error) {
      console.error('Failed to request speech recognition permission:', error);
      setHasPermission(false);
      return false;
    }
  };

  const startListening = useCallback(async () => {
    if (isListening || !nativeModuleAvailable) return;

    if (hasPermission === false) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(
          'Microphone Permission Required',
          'Please enable microphone access in Settings to use voice dictation.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    if (hasPermission === null && !permissionRequested) {
      setPermissionRequested(true);
      const granted = await requestPermission();
      if (!granted) return;
    }

    try {
      setIsListening(true);

      // Set up event listeners
      const resultListener = ExpoSpeechRecognitionModule.addListener('result', (event: { isFinal: boolean; results: Array<{ transcript: string }> }) => {
        if (event.isFinal && event.results && event.results.length > 0) {
          const transcript = event.results[0].transcript;
          if (transcript) {
            onTranscription(transcript);
          }
        }
      });

      const errorListener = ExpoSpeechRecognitionModule.addListener('error', (event: { error: string; message: string }) => {
        console.error('Speech recognition error:', event);
        setIsListening(false);
        Alert.alert('Voice Dictation Error', `Failed to recognize speech: ${event.message}. Please try again.`);
      });

      const endListener = ExpoSpeechRecognitionModule.addListener('end', () => {
        setIsListening(false);
      });

      listenerRef.current = {
        remove: () => {
          resultListener.remove();
          errorListener.remove();
          endListener.remove();
        },
      };

      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: true,
        addsPunctuation: true,
      });
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      setIsListening(false);
      Alert.alert('Voice Dictation Error', 'Unable to start voice recognition. Please try again.');
    }
  }, [isListening, hasPermission, permissionRequested, onTranscription, nativeModuleAvailable]);

  const stopListening = useCallback(async () => {
    if (!isListening || !nativeModuleAvailable) return;

    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      console.error('Failed to stop speech recognition:', error);
    } finally {
      setIsListening(false);
      if (listenerRef.current) {
        listenerRef.current.remove();
        listenerRef.current = null;
      }
    }
  }, [isListening, nativeModuleAvailable]);

  const toggleListening = useCallback(() => {
    if (!nativeModuleAvailable) {
      Alert.alert(
        'Voice Dictation Unavailable',
        'Speech recognition requires a development build. Please build the app with EAS Build and install on your device.',
        [{ text: 'OK' }]
      );
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening, nativeModuleAvailable]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (listenerRef.current) {
        listenerRef.current.remove();
      }
    };
  }, []);

  if (disabled || hasPermission === false || !nativeModuleAvailable) {
    return (
      <Pressable
        style={[
          styles.button,
          disabled && styles.buttonDisabled,
          hasPermission === false && styles.buttonNoPermission,
          !nativeModuleAvailable && styles.buttonUnavailable,
        ]}
        onPress={toggleListening}
        disabled={disabled}
        accessibilityLabel={
          !nativeModuleAvailable
            ? 'Voice dictation requires development build'
            : hasPermission === false
            ? 'Microphone permission denied'
            : 'Voice dictation'
        }
      >
        <SymbolView
          name={!nativeModuleAvailable ? 'mic.slash.fill' : isListening ? 'mic.fill' : 'mic.slash.fill'}
          size={20}
          weight="bold"
          tintColor={!nativeModuleAvailable ? '#94a3b8' : isListening ? '#ef4444' : '#94a3b8'}
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[
        styles.button,
        isListening && styles.buttonListening,
      ]}
      onPress={toggleListening}
      accessibilityLabel={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
    >
      <SymbolView
        name="mic.fill"
        size={20}
        weight="bold"
        tintColor={isListening ? '#ef4444' : '#0284c7'}
      />
      {isListening && (
        <View style={styles.pulseRing} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  buttonListening: {
    backgroundColor: '#fef2f2',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonNoPermission: {
    backgroundColor: '#fef3c7',
  },
  buttonUnavailable: {
    backgroundColor: '#f1f5f9',
  },
  pulseRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#ef4444',
  },
});