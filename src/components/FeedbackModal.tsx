import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { openDb } from '@/db/client';
import {
  createFeedbackPayload,
  FEEDBACK_TYPES,
  formatFeedbackPayload,
  type FeedbackSource,
  type FeedbackType,
} from '@/feedback/payload';
import { useTheme } from '@/theme/ThemeProvider';
import type { ThemeTokens } from '@/theme/tokens';

interface FeedbackModalProps {
  visible: boolean;
  currentRoute: string;
  source: FeedbackSource;
  onClose: () => void;
}

export default function FeedbackModal({
  visible,
  currentRoute,
  source,
  onClose,
}: FeedbackModalProps) {
  const { tokens: T } = useTheme();
  const styles = useMemo(() => createStyles(T), [T]);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('Bug');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setFeedbackType('Bug');
    setMessage('');
    setSubmitting(false);
  }, [visible]);

  const submit = async () => {
    if (submitting) return;

    setSubmitting(true);
    try {
      const db = await openDb();
      const payload = await createFeedbackPayload(db, {
        feedbackType,
        message,
        currentRoute,
        source,
      });
      const json = formatFeedbackPayload(payload);

      try {
        await Clipboard.setStringAsync(json);
      } catch {
        // The share sheet still carries the same payload if clipboard access is unavailable.
      }

      await Share.share({
        title: 'Set feedback',
        message: json,
      });
      onClose();
    } catch {
      Alert.alert('Feedback not ready', 'Could not prepare the feedback payload.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet} testID="feedback-modal">
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>Send Feedback</Text>
            </View>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={onClose}
              disabled={submitting}
              hitSlop={8}
              testID="feedback-close-btn"
            >
              <Ionicons name="close" size={16} color={T.textDim} />
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Type</Text>
            <View style={styles.segmented}>
              {FEEDBACK_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.segment, feedbackType === type && styles.segmentActive]}
                  onPress={() => setFeedbackType(type)}
                  disabled={submitting}
                  testID={`feedback-type-${type.toLowerCase()}`}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      feedbackType === type && styles.segmentTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              editable={!submitting}
              placeholder="Optional"
              placeholderTextColor={T.muted}
              multiline
              textAlignVertical="top"
              testID="feedback-message-input"
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={submitting}
              testID="feedback-cancel-btn"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={() => void submit()}
              disabled={submitting}
              testID="feedback-submit-btn"
            >
              {submitting ? (
                <ActivityIndicator color={T.accentInk} />
              ) : (
                <>
                  <Text style={styles.submitText}>Share</Text>
                  <Ionicons name="share-outline" size={17} color={T.accentInk} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(T: ThemeTokens) {
  return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.66)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: T.bg,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: T.text, fontSize: 20, fontWeight: '800' },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: 8 },
  label: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: T.muted,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.borderBright,
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },
  segmentActive: { backgroundColor: T.surface3 },
  segmentText: { color: T.textDim, fontSize: 13, fontWeight: '800' },
  segmentTextActive: { color: T.text },
  messageInput: {
    minHeight: 108,
    maxHeight: 150,
    borderWidth: 1,
    borderColor: T.borderBright,
    borderRadius: 12,
    backgroundColor: T.surface,
    color: T.text,
    padding: 12,
    fontSize: 15,
    lineHeight: 21,
  },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  cancelText: { color: T.textDim, fontSize: 15, fontWeight: '800' },
  submitBtn: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: T.accent,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitText: { color: T.accentInk, fontSize: 15, fontWeight: '900' },
  });
}
