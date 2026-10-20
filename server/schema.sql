-- Honeyleaf database (generated from server/private/migrations by scripts/build-schema.mjs).
-- Import this file in phpMyAdmin into an empty database, or let the setup
-- screen create the tables for you. Either way gives the same result.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- 0001_init.sql

-- Honeyleaf schema 1: everything the diary needs.
-- InnoDB, utf8mb4, times are UTC DATETIMEs. Every table that holds someone's
-- things has PRIMARY KEY (user_id, id), so an ID can never reach another
-- person's row, and goes away with its owner (ON DELETE CASCADE).

CREATE TABLE IF NOT EXISTS app_meta (
  name VARCHAR(64) NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS migrations (
  id INT UNSIGNED NOT NULL,
  name VARCHAR(190) NOT NULL,
  applied_at DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(32) NOT NULL,
  username_key VARCHAR(32) NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'member') NOT NULL DEFAULT 'member',
  active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  recovery_hash VARCHAR(255) NULL,
  storage_limit_bytes BIGINT UNSIGNED NULL,
  lock_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_username (username_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(64) NOT NULL,
  public_id CHAR(16) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  csrf CHAR(64) NOT NULL,
  remember TINYINT(1) NOT NULL DEFAULT 0,
  locked TINYINT(1) NOT NULL DEFAULT 0,
  user_agent VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  last_seen_at DATETIME NOT NULL,
  last_active_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY sessions_public (public_id),
  KEY sessions_user (user_id),
  KEY sessions_expires (expires_at),
  CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bucket VARCHAR(190) NOT NULL,
  hit_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY rate_bucket (bucket, hit_at),
  KEY rate_time (hit_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS journals (
  user_id INT UNSIGNED NOT NULL,
  id CHAR(26) NOT NULL,
  title VARCHAR(120) NOT NULL,
  cover MEDIUMTEXT NOT NULL,
  defaults_json MEDIUMTEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (user_id, id),
  CONSTRAINT journals_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entries (
  user_id INT UNSIGNED NOT NULL,
  id CHAR(26) NOT NULL,
  journal_id CHAR(26) NOT NULL,
  entry_date DATE NOT NULL,
  title VARCHAR(200) NOT NULL DEFAULT '',
  header MEDIUMTEXT NOT NULL,
  schema_version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  has_photos TINYINT(1) NOT NULL DEFAULT 0,
  conflict_of CHAR(26) NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (user_id, id),
  KEY entries_journal (user_id, journal_id, deleted_at, entry_date),
  CONSTRAINT entries_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pages (
  user_id INT UNSIGNED NOT NULL,
  id CHAR(26) NOT NULL,
  entry_id CHAR(26) NOT NULL,
  page_index INT UNSIGNED NOT NULL,
  doc MEDIUMTEXT NOT NULL,
  plain_text MEDIUMTEXT NOT NULL,
  favorite TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (user_id, id),
  KEY pages_entry (user_id, entry_id, deleted_at, page_index),
  FULLTEXT KEY pages_text (plain_text),
  CONSTRAINT pages_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS entry_tags (
  user_id INT UNSIGNED NOT NULL,
  entry_id CHAR(26) NOT NULL,
  tag VARCHAR(64) NOT NULL,
  PRIMARY KEY (user_id, entry_id, tag),
  KEY entry_tags_tag (user_id, tag),
  CONSTRAINT entry_tags_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS assets (
  user_id INT UNSIGNED NOT NULL,
  id CHAR(26) NOT NULL,
  kind ENUM('photo', 'sticker', 'font') NOT NULL,
  mime VARCHAR(64) NOT NULL,
  file_name CHAR(32) NOT NULL,
  thumb_name CHAR(32) NULL,
  thumb_mime VARCHAR(64) NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  bytes BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(200) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (user_id, id),
  KEY assets_kind (user_id, kind, deleted_at, created_at),
  CONSTRAINT assets_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  user_id INT UNSIGNED NOT NULL,
  data MEDIUMTEXT NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT settings_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Record the migrations above as applied.
INSERT IGNORE INTO migrations (id, name, applied_at) VALUES (1, '0001_init', UTC_TIMESTAMP());
