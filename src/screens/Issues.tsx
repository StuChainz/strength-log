import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { openDb } from '@/db/client';
import { getIssues, type IssueWithReactionCount } from '@/db/repositories/issues.repo';
import { T } from '@/theme/tokens';
import type { IssuesNavigationProp } from '@/navigation/types';

export default function Issues() {
  const navigation = useNavigation<IssuesNavigationProp>();
  const [issues, setIssues] = useState<IssueWithReactionCount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const db = await openDb();
    setIssues(await getIssues(db, true));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={8}
          testID="issues-back-btn"
        >
          <Ionicons name="arrow-back" size={20} color={T.textDim} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Personal</Text>
          <Text style={styles.title}>Injuries</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('IssueDetail', {})}
          testID="new-issue-btn"
        >
          <Ionicons name="add" size={19} color={T.accentInk} />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={T.accent} />
        </View>
      ) : (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {issues.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No injuries yet.</Text>
            </View>
          ) : (
            issues.map((issue) => (
              <TouchableOpacity
                key={issue.id}
                style={[styles.issueRow, issue.active === 0 && styles.issueRowArchived]}
                onPress={() => navigation.navigate('IssueDetail', { issueId: issue.id })}
                testID={`issue-row-${issue.id}`}
              >
                <View style={styles.issueMain}>
                  <Text style={styles.issueName} numberOfLines={1}>
                    {issue.name}
                  </Text>
                  {issue.note ? (
                    <Text style={styles.issueNote} numberOfLines={1}>
                      {issue.note}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.issueMeta}>
                  <Text style={styles.issueCount}>
                    {issue.reaction_count} {issue.reaction_count === 1 ? 'record' : 'records'}
                  </Text>
                  {issue.active === 0 && <Text style={styles.archivedText}>Archived</Text>}
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
  },
  title: { color: T.text, fontSize: 28, fontWeight: '700', marginTop: 2 },
  addBtn: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: T.accent,
    paddingHorizontal: 14,
  },
  addBtnText: { color: T.accentInk, fontSize: 14, fontWeight: '700' },
  container: { flex: 1 },
  content: { padding: 18, gap: 8 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.border,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
  },
  emptyText: { color: T.muted, fontSize: 13 },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 14,
  },
  issueRowArchived: { opacity: 0.62 },
  issueMain: { flex: 1, minWidth: 0 },
  issueName: { color: T.text, fontSize: 16, fontWeight: '700' },
  issueNote: { color: T.textDim, fontSize: 12, marginTop: 4 },
  issueMeta: { alignItems: 'flex-end', gap: 4 },
  issueCount: { color: T.textDim, fontFamily: 'Courier New', fontSize: 11 },
  archivedText: { color: T.muted, fontFamily: 'Courier New', fontSize: 10 },
});
