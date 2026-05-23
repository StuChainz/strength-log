type MockDb = {
  getAllAsync: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  getFirstAsync: <T>(sql: string, params?: unknown[]) => Promise<T | null>;
  runAsync: (sql: string, params?: unknown[]) => Promise<{ lastInsertRowId: number; changes: number }>;
  execAsync: (sql: string) => Promise<void>;
  withTransactionAsync: (fn: () => Promise<void>) => Promise<void>;
};

const mockDb: MockDb = {
  getAllAsync: async () => [],
  getFirstAsync: async () => null,
  runAsync: async () => ({ lastInsertRowId: 0, changes: 0 }),
  execAsync: async () => {},
  withTransactionAsync: async (fn) => fn(),
};

export async function openDb(): Promise<MockDb> {
  return mockDb;
}

export function _resetDbSingleton(): void {}
