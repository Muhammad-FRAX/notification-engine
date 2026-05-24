export const up = async (pgm) => {
  pgm.createTable('group_members', {
    id: { type: 'text', primaryKey: true },
    group_id: {
      type: 'text',
      notNull: true,
      references: '"groups"(id)',
      onDelete: 'CASCADE',
    },
    member_type: { type: 'text', notNull: true },
    member_id: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    'group_members',
    'group_members_type_check',
    "CHECK (member_type IN ('user', 'channel'))"
  );
  pgm.addConstraint(
    'group_members',
    'group_members_unique',
    'UNIQUE(group_id, member_type, member_id)'
  );
};

export const down = async (pgm) => {
  pgm.dropTable('group_members');
};
