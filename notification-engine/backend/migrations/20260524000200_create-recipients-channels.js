export const up = async (pgm) => {
  pgm.createTable('recipients_channels', {
    id: { type: 'text', primaryKey: true },
    display_name: { type: 'text', notNull: true },
    team_id: { type: 'text', notNull: true },
    channel_id: { type: 'text', notNull: true },
    notes: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    'recipients_channels',
    'recipients_channels_team_channel_unique',
    'UNIQUE(team_id, channel_id)'
  );
};

export const down = async (pgm) => {
  pgm.dropTable('recipients_channels');
};
