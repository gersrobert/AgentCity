let sessionKey: string | null = null;

export const setKey = (key: string): void => {
  sessionKey = key;
};

export const getKey = (): string | null => sessionKey;

export const clearKey = (): void => {
  sessionKey = null;
};

export const hasKey = (): boolean => sessionKey !== null;
