export const up = async (pgm) => {
  pgm.createTable('proxy_account', {
    id: { type: 'integer', primaryKey: true, default: 1 },
    upn: { type: 'text' },
    aad_user_id: { type: 'text' },
    display_name: { type: 'text' },
    cache_path: { type: 'text' },
    last_sign_in_at: { type: 'timestamptz' },
    status: { type: 'text' },
  });
  pgm.addConstraint('proxy_account', 'proxy_account_id_check', 'CHECK (id = 1)');
  // Seed the single required row so every other query can assume it exists
  pgm.sql("INSERT INTO proxy_account (id, status) VALUES (1, 'signed_out') ON CONFLICT DO NOTHING");
};

export const down = async (pgm) => {
  pgm.dropTable('proxy_account');
};
