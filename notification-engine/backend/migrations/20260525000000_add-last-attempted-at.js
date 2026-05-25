export const up = async (pgm) => {
  pgm.addColumn('notification_deliveries', {
    last_attempted_at: { type: 'timestamptz' },
  });
};

export const down = async (pgm) => {
  pgm.dropColumn('notification_deliveries', 'last_attempted_at');
};
