<?php

// Honeyleaf settings.
//
// 1. Copy this file to config.php (in this same honeyleaf_private folder).
// 2. Fill in the database details from hPanel → Databases → MySQL Databases.
// 3. Choose a setup key: a long phrase only you know. The setup screen asks
//    for it once, to prove the person creating the admin account is you.
//
// Keep this file private: it is outside public_html, and nothing in this
// folder can be opened from the web.

return [
    // Database (MySQL or MariaDB). On Hostinger the host is usually 'localhost'.
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'u123456789_honeyleaf',
    'db_user' => 'u123456789_honeyleaf',
    'db_pass' => 'the database password',

    // At least 12 characters. Example: 'paper-lantern-maple-tea-7'
    'setup_key' => '',

    // Emergency reset of the admin password when the recovery code is lost
    // too (see the README). Leave empty; set it only when you need it, use it
    // once, then empty it again.
    'admin_reset_token' => '',

    // Largest single photo or font upload, in bytes (15 MB).
    'max_upload_bytes' => 15 * 1024 * 1024,

    // Storage limit for new accounts, in bytes (null = no limit). The admin
    // can change each person's limit on the key ring.
    'storage_default_bytes' => null,

    // Days things stay in the wastebasket before they are deleted for good.
    'trash_days' => 30,

    // Hours a session lasts without "remember this device" when idle.
    'session_hours' => 12,

    // Where photos are stored. null = the uploads folder next to this file.
    'uploads_dir' => null,

    // Only if a proxy in front of the server handles HTTPS and says so.
    'trust_proxy_https' => false,
];
