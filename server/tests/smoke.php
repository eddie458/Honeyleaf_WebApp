<?php

declare(strict_types=1);

// End-to-end check of the API against a throwaway database.
//
//   php server/tests/smoke.php [path/to/config.php]
//
// The config (default .tools/config.test.php, see scripts/dev/make-config.mjs)
// must point at a database that may be wiped: every table in it is dropped
// first. Starts PHP's built-in server, then walks through setup, signing in,
// accounts, privacy between people, entries and conflicts, photos, trash,
// the padlock, export and rate limits. Exits 1 if anything is wrong.

if (PHP_SAPI !== 'cli') {
    exit(1);
}
foreach (['curl', 'pdo_mysql', 'gd', 'zip'] as $ext) {
    if (!extension_loaded($ext)) {
        fwrite(STDERR, "The smoke test needs the PHP extension $ext.\n");
        exit(1);
    }
}

$repo = dirname(__DIR__, 2);
$configFile = $argv[1] ?? $repo . '/.tools/config.test.php';
if (!is_file($configFile)) {
    fwrite(STDERR, "No test config at $configFile (run: node scripts/dev/make-config.mjs)\n");
    exit(1);
}
$config = require $configFile;
// A copy of the config with an emergency reset token, for the recovery checks.
$config['admin_reset_token'] = 'smoke-test-reset-token-' . bin2hex(random_bytes(6));
$configFile = sys_get_temp_dir() . '/honeyleaf-smoke-config.php';
file_put_contents($configFile, '<?php return ' . var_export($config, true) . ';');

/* ------------------------------------------------------------ fresh database */

$pdo = new PDO(sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $config['db_host'], $config['db_port'], $config['db_name']), $config['db_user'], $config['db_pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
    $pdo->exec('DROP TABLE `' . str_replace('`', '', (string) $table) . '`');
}
$pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
$uploads = $config['uploads_dir'] ?? null;
if (is_string($uploads) && is_dir($uploads)) {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($uploads, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($it as $f) {
        $f->isDir() ? rmdir($f->getPathname()) : unlink($f->getPathname());
    }
}

/* ------------------------------------------------------------- the server */

$port = 8099;
$server = proc_open(
    [PHP_BINARY, '-S', "127.0.0.1:$port", '-t', $repo . '/server/public', $repo . '/server/dev-router.php'],
    [0 => ['pipe', 'r'], 1 => ['file', sys_get_temp_dir() . '/honeyleaf-smoke-server.log', 'w'], 2 => ['file', sys_get_temp_dir() . '/honeyleaf-smoke-server.log', 'a']],
    $pipes,
    $repo,
    array_merge(getenv(), ['HONEYLEAF_CONFIG' => $configFile]),
    ['bypass_shell' => true],
);
if (!is_resource($server)) {
    fwrite(STDERR, "Could not start the PHP server.\n");
    exit(1);
}
register_shutdown_function(static function () use ($server): void {
    proc_terminate($server);
});
$base = "http://127.0.0.1:$port/";
for ($i = 0; $i < 50; $i++) {
    if (@file_get_contents($base . 'api/health') !== false) {
        break;
    }
    usleep(100000);
}

/* --------------------------------------------------------------- browsers */

final class Browser
{
    public string $csrf = '';
    private string $jar;
    /** @var array<string, string> */
    public array $lastHeaders = [];

    public function __construct(private string $base, string $name)
    {
        $this->jar = sys_get_temp_dir() . "/honeyleaf-smoke-$name.jar";
        @unlink($this->jar);
    }

    /** @return array{status: int, body: mixed, raw: string} */
    public function call(string $method, string $route, mixed $body = null, array $files = [], bool $csrf = true): array
    {
        $ch = curl_init($this->base . 'api/' . $route);
        $headers = ['Accept: application/json'];
        if ($csrf && $method !== 'GET') {
            $headers[] = 'X-Honeyleaf-CSRF: ' . $this->csrf;
        }
        if ($files !== []) {
            $post = is_array($body) ? $body : [];
            foreach ($files as $field => $file) {
                $post[$field] = new CURLFile($file['path'], $file['type'], $file['name']);
            }
            curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
        } elseif ($body !== null) {
            $headers[] = 'Content-Type: application/json';
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_SLASHES));
        }
        $this->lastHeaders = [];
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_COOKIEJAR => $this->jar,
            CURLOPT_COOKIEFILE => $this->jar,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_HEADERFUNCTION => function ($ch, string $line): int {
                $parts = explode(':', $line, 2);
                if (count($parts) === 2) {
                    $name = strtolower(trim($parts[0]));
                    $value = trim($parts[1]);
                    $this->lastHeaders[$name] = isset($this->lastHeaders[$name]) ? $this->lastHeaders[$name] . "\n" . $value : $value;
                }
                return strlen($line);
            },
        ]);
        $raw = (string) curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        $decoded = json_decode($raw, true);
        return ['status' => $status, 'body' => $decoded, 'raw' => $raw];
    }

    public function refreshCsrf(): array
    {
        $s = $this->call('GET', 'session');
        $this->csrf = (string) ($s['body']['csrf'] ?? '');
        return $s['body'] ?? [];
    }
}

$failures = 0;
$passes = 0;
function check(bool $ok, string $what, mixed $detail = null): void
{
    global $failures, $passes;
    if ($ok) {
        $passes++;
        echo "  ok    $what\n";
    } else {
        $failures++;
        echo "  FAIL  $what" . ($detail !== null ? '  →  ' . substr(is_string($detail) ? $detail : json_encode($detail, JSON_UNESCAPED_SLASHES), 0, 400) : '') . "\n";
    }
}
function errorCode(array $r): ?string
{
    return $r['body']['error']['code'] ?? null;
}
function ulid(): string
{
    $a = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    $t = (int) floor(microtime(true) * 1000);
    $h = '';
    for ($i = 0; $i < 10; $i++) {
        $h = $a[$t % 32] . $h;
        $t = intdiv($t, 32);
    }
    $r = '';
    for ($i = 0; $i < 16; $i++) {
        $r .= $a[random_int(0, 31)];
    }
    return $h . $r;
}
function page(string $id, string $text, array $decorations = [], ?string $flow = null): array
{
    $doc = ['v' => 1, 'paper' => ['id' => 'lined-cream'], 'area' => ['top' => 112, 'right' => 36, 'bottom' => 28, 'left' => 76],
        'text' => ['type' => 'doc', 'content' => [['type' => 'paragraph', 'attrs' => (object) [], 'content' => [['type' => 'text', 'text' => $text]]]]],
        'decorations' => $decorations];
    if ($flow !== null) {
        $doc['flow'] = $flow;
    }
    return ['id' => $id, 'doc' => $doc];
}

$admin = new Browser($base, 'admin');
$friend = new Browser($base, 'friend');
$stranger = new Browser($base, 'stranger');
$setupKey = (string) $config['setup_key'];
$adminPass = 'correct horse battery staple';

echo "Setup\n";
$r = $admin->call('GET', 'health');
check($r['status'] === 200 && ($r['body']['ok'] ?? false) === true, 'health answers');
$s = $admin->refreshCsrf();
check(($s['state'] ?? '') === 'setup', 'a fresh install asks for setup', $s);
$r = $admin->call('GET', 'setup/check');
check($r['status'] === 200 && ($r['body']['db']['connected'] ?? false) === true && ($r['body']['db']['tablesReady'] ?? true) === false, 'setup check sees the database, no tables yet', $r['body']);
$r = $admin->call('POST', 'setup/install-schema', ['setupKey' => 'wrong key, wrong key']);
check($r['status'] === 403 && errorCode($r) === 'bad_setup_key', 'a wrong setup key is refused', $r['body']);
$r = $admin->call('POST', 'setup/install-schema', ['setupKey' => $setupKey]);
check($r['status'] === 200, 'the setup key creates the tables', $r['body']);
$r = $admin->call('POST', 'setup/admin', ['setupKey' => $setupKey, 'username' => 'eddie', 'displayName' => 'Eddie', 'password' => 'short']);
check($r['status'] === 400 && errorCode($r) === 'validation' && ($r['body']['error']['fields']['password'] ?? '') === 'weak', 'a short admin password is refused', $r['body']);
$r = $admin->call('POST', 'setup/admin', ['setupKey' => $setupKey, 'username' => 'eddie', 'displayName' => 'Eddie', 'password' => $adminPass]);
$recovery = (string) ($r['body']['recoveryCode'] ?? '');
check($r['status'] === 200 && preg_match('/^[2-9A-Z]{4}(-[2-9A-Z]{4}){3}$/', $recovery) === 1, 'the first admin is made, with a recovery code', $r['body']);
$r = $admin->call('POST', 'setup/admin', ['setupKey' => $setupKey, 'username' => 'mallory', 'displayName' => 'M', 'password' => 'another long password']);
check($r['status'] === 403 && errorCode($r) === 'setup_done', 'setup switches itself off', $r['body']);
$r = $stranger->call('GET', 'setup/check');
check($r['status'] === 403 && errorCode($r) === 'setup_done', 'the setup check is closed too', $r['body']);

echo "Signing in\n";
$s = $admin->refreshCsrf();
check(($s['state'] ?? '') === 'signed_out' && strlen((string) ($s['csrf'] ?? '')) === 64, 'signed out, with a CSRF token', $s);
$r = $admin->call('POST', 'auth/login', ['username' => 'eddie', 'password' => $adminPass], [], false);
check($r['status'] === 403 && errorCode($r) === 'csrf', 'sign-in without the CSRF token is refused', $r['body']);
$r = $admin->call('POST', 'auth/login', ['username' => 'eddie', 'password' => 'not the password']);
check($r['status'] === 401 && errorCode($r) === 'invalid_credentials', 'a wrong password is refused', $r['body']);
$r = $admin->call('POST', 'auth/login', ['username' => 'nobody', 'password' => 'not the password']);
check($r['status'] === 401 && errorCode($r) === 'invalid_credentials', 'an unknown name gets the same answer', $r['body']);
$r = $admin->call('POST', 'auth/login', ['username' => 'Eddie', 'password' => $adminPass, 'remember' => true]);
$cookie = $admin->lastHeaders['set-cookie'] ?? '';
check($r['status'] === 200 && ($r['body']['user']['role'] ?? '') === 'admin', 'the admin signs in (name in any case)', $r['body']);
check(str_contains($cookie, 'hl_session=') && str_contains($cookie, 'HttpOnly') && str_contains($cookie, 'SameSite=Lax') && str_contains($cookie, 'Max-Age=2592000'), 'the session cookie is HttpOnly, SameSite=Lax, remembered 30 days', $cookie);
// Browsers drop a malformed Path (curl doesn't), so check it to the letter.
check(preg_match('#(^|; )Path=/(;|$)#', $cookie) === 1, 'and belongs to the whole install (Path=/)', $cookie);
$admin->csrf = (string) ($r['body']['csrf'] ?? '');
$s = $admin->refreshCsrf();
check(($s['state'] ?? '') === 'signed_in' && ($s['user']['username'] ?? '') === 'eddie', 'the session says signed in', $s);
$r = $admin->call('GET', 'journals');
check(($admin->lastHeaders['cache-control'] ?? '') === 'no-store' && ($admin->lastHeaders['x-content-type-options'] ?? '') === 'nosniff', 'answers are never cached and never sniffed', $admin->lastHeaders);

echo "Accounts (invite only)\n";
$r = $admin->call('POST', 'admin/users', ['username' => 'june', 'displayName' => 'June', 'password' => 'temporary-pass-1']);
$juneId = (int) ($r['body']['user']['id'] ?? 0);
check($r['status'] === 201 && ($r['body']['user']['mustChangePassword'] ?? false) === true, 'the admin makes a friend an account (temporary password)', $r['body']);
$r = $admin->call('POST', 'admin/users', ['username' => 'JUNE', 'displayName' => 'June 2', 'password' => 'temporary-pass-1']);
check($r['status'] === 400 && ($r['body']['error']['fields']['username'] ?? '') === 'taken', 'names are unique, whatever the case', $r['body']);
$r = $admin->call('GET', 'admin/users');
check($r['status'] === 200 && count($r['body']['users'] ?? []) === 2, 'the admin sees the people (not their diaries)', $r['body']);
$stranger->refreshCsrf();
$r = $stranger->call('POST', 'admin/users', ['username' => 'sneaky', 'displayName' => 'S', 'password' => 'a long password here']);
check($r['status'] === 401, 'nobody can sign themselves up', $r['body']);
$friend->refreshCsrf();
$r = $friend->call('POST', 'auth/login', ['username' => 'june', 'password' => 'temporary-pass-1']);
$friend->csrf = (string) ($r['body']['csrf'] ?? '');
check($r['status'] === 200 && ($r['body']['user']['mustChangePassword'] ?? false) === true, 'the friend signs in with the temporary password', $r['body']);
$r = $friend->call('GET', 'journals');
check($r['status'] === 403 && errorCode($r) === 'must_change_password', 'nothing opens until she picks her own password', $r['body']);
$r = $friend->call('POST', 'auth/password', ['current' => 'temporary-pass-1', 'next' => 'junes own password']);
check($r['status'] === 200 && ($r['body']['user']['mustChangePassword'] ?? true) === false, 'she sets her own password', $r['body']);
$r = $friend->call('POST', 'admin/users', ['username' => 'sneaky', 'displayName' => 'S', 'password' => 'a long password here']);
check($r['status'] === 403 && errorCode($r) === 'forbidden', 'a member cannot make accounts', $r['body']);
$r = $friend->call('GET', 'admin/users');
check($r['status'] === 403, 'or see the list of people', $r['body']);

echo "Journals and entries\n";
$journal = ulid();
$jbody = ['title' => 'My diary', 'cover' => ['material' => 'leather', 'color' => '#6e3b44'], 'defaults' => ['paper' => 'lined-cream', 'font' => 'caveat', 'size' => 22], 'sortOrder' => 0];
$r = $admin->call('PUT', "journals/$journal", $jbody);
check($r['status'] === 200 && ($r['body']['journal']['id'] ?? '') === $journal, 'a journal is made with the client\'s ID', $r['body']);
$entryId = ulid();
$p1 = ulid();
$p2 = ulid();
$header = ['date' => '2026-10-19', 'title' => 'Rainy Monday', 'tags' => ['rain', 'cocoa'], 'empty' => (object) []];
$save = fn (?int $base, array $pages, string $title = 'Rainy Monday') => $admin->call('PUT', "entries/$entryId", ['baseVersion' => $base, 'entry' => ['journalId' => $journal, 'date' => '2026-10-19', 'title' => $title, 'header' => $header, 'schema' => 1], 'pages' => $pages]);
$r = $save(null, [page($p1, 'The rain came in sideways.'), page($p2, 'And the cat found the sun.', [], 'auto')]);
check($r['status'] === 200 && ($r['body']['version'] ?? 0) === 1, 'a new entry saves as version 1', $r['body']);
$r = $admin->call('GET', "journals/$journal/entries");
$idx = $r['body']['entries'][0] ?? [];
check(($idx['pageCount'] ?? 0) === 2 && ($idx['pageIds'] ?? []) === [$p1, $p2] && ($idx['date'] ?? '') === '2026-10-19', 'the index lists it with its pages in order', $r['body']);
$r = $admin->call('GET', "entries/$entryId");
check(($r['body']['pages'][0]['doc']['text']['content'][0]['content'][0]['text'] ?? '') === 'The rain came in sideways.' && str_contains($r['raw'], '"empty":{}') && str_contains($r['raw'], '"attrs":{}'), 'the entry comes back exactly as written (empty objects stay objects)', $r['raw']);
$r = $save(1, [page($p1, 'The rain came in sideways, and I made cocoa.')]);
check($r['status'] === 200 && ($r['body']['version'] ?? 0) === 2, 'saving on top of version 1 makes version 2', $r['body']);
$r = $admin->call('GET', "entries/$entryId");
check(count($r['body']['pages'] ?? []) === 1, 'a page the flow dropped is gone', $r['body']);
$r = $save(1, [page($p1, 'Words written on another device.')], 'Rainy Monday');
$copyId = (string) ($r['body']['conflictCopyId'] ?? '');
check($r['status'] === 409 && errorCode($r) === 'conflict' && $copyId !== '' && ($r['body']['current']['entry']['version'] ?? 0) === 2, 'an out-of-date save is not lost and overwrites nothing', $r['body']);
$r = $admin->call('GET', "entries/$copyId");
check(($r['body']['entry']['conflictOf'] ?? '') === $entryId && str_contains((string) ($r['body']['entry']['title'] ?? ''), 'copy from another device') && ($r['body']['pages'][0]['doc']['text']['content'][0]['content'][0]['text'] ?? '') === 'Words written on another device.', 'its words are kept as a copy beside the original', $r['body']);
$r = $admin->call('GET', "entries/$entryId");
check(($r['body']['pages'][0]['doc']['text']['content'][0]['content'][0]['text'] ?? '') === 'The rain came in sideways, and I made cocoa.', 'and the original is untouched', $r['body']);
$r = $admin->call('PUT', 'entries/' . ulid(), ['baseVersion' => null, 'entry' => ['journalId' => $journal, 'date' => '2026-02-30', 'title' => '', 'header' => (object) [], 'schema' => 9], 'pages' => []]);
check($r['status'] === 400 && isset($r['body']['error']['fields']['date'], $r['body']['error']['fields']['schema']), 'impossible dates and newer formats are refused', $r['body']);

echo "Privacy between people\n";
$r = $friend->call('GET', "entries/$entryId");
check($r['status'] === 404, 'June cannot read Eddie\'s entry', $r['body']);
$r = $friend->call('GET', "journals/$journal/entries");
check($r['status'] === 200 && ($r['body']['entries'] ?? null) === [], 'or list it', $r['body']);
$r = $friend->call('DELETE', "entries/$entryId");
check($r['status'] === 404, 'or throw it away', $r['body']);
$r = $friend->call('PUT', "journals/$journal", $jbody);
$r2 = $friend->call('PUT', "entries/$entryId", ['baseVersion' => null, 'entry' => ['journalId' => $journal, 'date' => '2026-10-19', 'title' => 'June\'s', 'header' => (object) [], 'schema' => 1], 'pages' => [page(ulid(), 'June\'s own words.')]]);
$r3 = $admin->call('GET', "entries/$entryId");
check($r2['status'] === 200 && ($r3['body']['entry']['title'] ?? '') === 'Rainy Monday', 'the same IDs in June\'s diary are hers alone; Eddie\'s entry is untouched', [$r2['body'], $r3['body']['entry'] ?? null]);

echo "Photos\n";
$png = sys_get_temp_dir() . '/honeyleaf-smoke.png';
$img = imagecreatetruecolor(3000, 2000);
imagefill($img, 0, 0, imagecolorallocate($img, 230, 160, 90));
imagefilledellipse($img, 2000, 900, 500, 500, imagecolorallocate($img, 255, 240, 170));
imagepng($img, $png);
$photo = ulid();
$r = $admin->call('POST', 'assets', ['id' => $photo, 'kind' => 'photo'], ['file' => ['path' => $png, 'type' => 'image/png', 'name' => 'sunset.png']]);
check($r['status'] === 201 && max($r['body']['asset']['width'] ?? 0, $r['body']['asset']['height'] ?? 0) === 2560 && in_array($r['body']['asset']['mime'] ?? '', ['image/webp', 'image/jpeg'], true), 'a photo is re-encoded and scaled to 2560 px', $r['body']);
$r = $admin->call('POST', 'assets', ['id' => $photo, 'kind' => 'photo'], ['file' => ['path' => $png, 'type' => 'image/png', 'name' => 'sunset.png']]);
check($r['status'] === 201 && ($r['body']['asset']['id'] ?? '') === $photo, 'sending it again is harmless', $r['body']);
$r = $admin->call('GET', "assets/$photo?size=full");
check($r['status'] === 200 && str_starts_with($admin->lastHeaders['content-type'] ?? '', 'image/') && str_contains($admin->lastHeaders['cache-control'] ?? '', 'private') && strlen($r['raw']) > 1000, 'its owner can open it', $admin->lastHeaders);
$r = $admin->call('GET', "assets/$photo?size=thumb");
$thumbSize = @getimagesizefromstring($r['raw']);
check($r['status'] === 200 && $thumbSize !== false && max($thumbSize[0], $thumbSize[1]) === 480, 'with a 480 px thumbnail', $thumbSize);
$r = $friend->call('GET', "assets/$photo?size=full");
check($r['status'] === 404 && !str_starts_with($friend->lastHeaders['content-type'] ?? '', 'image/'), 'June gets nothing for Eddie\'s photo', $r['status']);
$r = $stranger->call('GET', "assets/$photo?size=full");
check($r['status'] === 401 && !str_starts_with($stranger->lastHeaders['content-type'] ?? '', 'image/'), 'and neither does someone signed out', $r['status']);
$fake = sys_get_temp_dir() . '/honeyleaf-smoke-fake.png';
file_put_contents($fake, "<?php echo 'hello'; ?>\n");
$r = $admin->call('POST', 'assets', ['id' => ulid(), 'kind' => 'photo'], ['file' => ['path' => $fake, 'type' => 'image/png', 'name' => 'innocent.png']]);
check($r['status'] === 415 && errorCode($r) === 'unsupported_type', 'files are judged by their bytes, not their names', $r['body']);
$stored = glob(rtrim((string) $config['uploads_dir'], '/') . '/*/*') ?: [];
check($stored !== [] && array_filter($stored, static fn ($f) => str_contains(basename($f), '.')) === [], 'stored files have random names without extensions', $stored);

echo "Trash\n";
$r = $save(2, [page($p1, 'The rain came in sideways, and I made cocoa.'), page($p2, 'A page with a photo.', [['id' => ulid(), 'type' => 'photo', 'asset' => "user:$photo", 'x' => 300, 'y' => 400, 'w' => 200, 'h' => 240, 'rot' => 0, 'z' => 1, 'layer' => 'front']])]);
check($r['status'] === 200 && ($r['body']['version'] ?? 0) === 3, 'a page with a photo is added', $r['body']);
$r = $save(3, [page($p1, 'The rain came in sideways, and I made cocoa.')]);
$r = $admin->call('GET', 'trash');
$trashedPage = array_values(array_filter($r['body']['items'] ?? [], static fn ($i) => $i['type'] === 'page' && $i['id'] === $p2));
check(count($trashedPage) === 1 && isset($trashedPage[0]['purgeAt']), 'a torn-out page with things on it goes to the wastebasket', $r['body']);
$r = $admin->call('POST', 'trash/restore', ['type' => 'page', 'id' => $p2]);
$r2 = $admin->call('GET', "entries/$entryId");
check($r['status'] === 200 && count($r2['body']['pages'] ?? []) === 2 && ($r2['body']['entry']['version'] ?? 0) === 5, 'it can be put back (at the end, as a new version)', $r2['body']['entry'] ?? $r2['body']);
$r = $admin->call('DELETE', "entries/$copyId");
check($r['status'] === 200, 'an entry goes to the wastebasket', $r['body']);
$r = $admin->call('GET', "journals/$journal/entries");
check(!in_array($copyId, array_column($r['body']['entries'] ?? [], 'id'), true), 'and leaves the book', $r['body']);
$r = $admin->call('POST', 'trash/restore', ['type' => 'entry', 'id' => $copyId]);
$r2 = $admin->call('GET', "entries/$copyId");
check($r['status'] === 200 && $r2['status'] === 200, 'and comes back', $r2['body']);
$admin->call('DELETE', "entries/$copyId");
$r = $admin->call('POST', 'trash/purge', ['type' => 'entry', 'id' => $copyId]);
$r2 = $admin->call('GET', "entries/$copyId");
check($r['status'] === 200 && $r2['status'] === 404, 'emptying the wastebasket deletes it for good', $r2['body']);

echo "Settings and the padlock\n";
$r = $admin->call('PUT', 'settings', ['settings' => ['lockMinutes' => 5, 'mug' => 'tea', 'nested' => (object) []]]);
$r2 = $admin->call('GET', 'settings');
check($r['status'] === 200 && ($r2['body']['settings']['mug'] ?? '') === 'tea' && str_contains($r2['raw'], '"nested":{}'), 'settings are kept', $r2['raw']);
$s = $admin->refreshCsrf();
check(($s['user']['lockMinutes'] ?? 0) === 5, 'the lock time follows the settings', $s);
$r = $admin->call('POST', 'auth/lock');
$r2 = $admin->call('GET', 'journals');
check($r['status'] === 200 && $r2['status'] === 423 && errorCode($r2) === 'locked', 'a locked diary opens nothing', $r2['body']);
$r = $admin->call('GET', "assets/$photo?size=full");
check($r['status'] === 423, 'not even photos', $r['status']);
$r = $admin->call('POST', 'auth/unlock', ['password' => 'wrong one']);
check($r['status'] === 401 && errorCode($r) === 'invalid_credentials', 'the wrong password does not unlock it', $r['body']);
$r = $admin->call('POST', 'auth/unlock', ['password' => $adminPass]);
$r2 = $admin->call('GET', 'journals');
check($r['status'] === 200 && $r2['status'] === 200, 'the right one does', $r2['body']);

echo "Export\n";
$zipFile = sys_get_temp_dir() . '/honeyleaf-smoke-export.zip';
$r = $admin->call('GET', 'export');
file_put_contents($zipFile, $r['raw']);
$zip = new ZipArchive();
$opened = $zip->open($zipFile) === true;
$json = $opened ? json_decode((string) $zip->getFromName('honeyleaf-export.json'), true) : null;
check($r['status'] === 200 && str_contains($admin->lastHeaders['content-disposition'] ?? '', 'honeyleaf-eddie-') && $opened, 'the export is a real zip', $admin->lastHeaders);
check(($json['format'] ?? 0) === 1 && count($json['entries'] ?? []) === 1 && count($json['entries'][0]['pages'] ?? []) === 2 && ($json['settings']['mug'] ?? '') === 'tea', 'with every entry, page and setting', $json);
$asset = $json['assets'][0] ?? [];
check(($asset['id'] ?? '') === $photo && $opened && strlen((string) $zip->getFromName((string) ($asset['file'] ?? '-'))) > 1000 && strlen((string) $zip->getFromName((string) ($asset['thumb'] ?? '-'))) > 100, 'and the photos themselves', $asset);
$r = $friend->call('GET', 'export');
file_put_contents($zipFile, $r['raw']);
$zip2 = new ZipArchive();
$json2 = $zip2->open($zipFile) === true ? json_decode((string) $zip2->getFromName('honeyleaf-export.json'), true) : null;
check(count($json2['entries'] ?? []) === 1 && ($json2['entries'][0]['title'] ?? '') === 'June\'s' && ($json2['assets'] ?? null) === [], 'June\'s export holds only June\'s things', $json2);

echo "Rate limits\n";
$limited = null;
for ($i = 0; $i < 7; $i++) {
    $r = $stranger->call('POST', 'auth/login', ['username' => 'june', 'password' => "guess $i"]);
    if ($r['status'] === 429) {
        $limited = $r;
        break;
    }
}
check($limited !== null && ($limited['body']['error']['retryAfter'] ?? 0) > 0 && $i === 5, 'five wrong guesses at a name and it waits', $limited['body'] ?? $r['body']);
$r = $stranger->call('POST', 'auth/login', ['username' => 'june', 'password' => 'junes own password']);
check($r['status'] === 429, 'even for the right password, until the wait is over', $r['body']);

echo "The admin's key ring\n";
$r = $admin->call('PATCH', "admin/users/$juneId", ['active' => false]);
$r2 = $friend->call('GET', 'journals');
check($r['status'] === 200 && ($r['body']['user']['active'] ?? true) === false && $r2['status'] === 401, 'switching an account off signs it out at once', $r2['body']);
$r = $admin->call('PATCH', "admin/users/1", ['active' => false]);
check($r['status'] === 400, 'the admin cannot switch themselves off', $r['body']);
$r = $admin->call('PATCH', "admin/users/$juneId", ['active' => true, 'storageLimitBytes' => 1000]);
check($r['status'] === 200 && ($r['body']['user']['storageLimitBytes'] ?? 0) === 1000, 'storage limits can be set', $r['body']);
$r = $admin->call('POST', "admin/users/$juneId/password", ['password' => 'new-temporary-2']);
check($r['status'] === 200 && ($r['body']['user']['mustChangePassword'] ?? false) === true, 'a forgotten password gets a new temporary one', $r['body']);
$r = $admin->call('DELETE', "admin/users/$juneId", ['confirm' => 'not june']);
check($r['status'] === 400, 'deleting an account needs its name typed', $r['body']);
$r = $admin->call('DELETE', "admin/users/$juneId", ['confirm' => 'june']);
$left = (int) $pdo->query("SELECT COUNT(*) FROM entries WHERE user_id = $juneId")->fetchColumn();
check($r['status'] === 200 && $left === 0, 'deleting an account removes everything it had', $r['body']);

echo "Recovery\n";
$stranger->refreshCsrf();
$r = $stranger->call('POST', 'auth/recover', ['username' => 'eddie', 'recoveryCode' => 'AAAA-BBBB-CCCC-DDDD', 'next' => 'a brand new password']);
check($r['status'] === 401, 'a wrong recovery code does nothing', $r['body']);
$r = $stranger->call('POST', 'auth/recover', ['username' => 'eddie', 'recoveryCode' => strtolower($recovery), 'next' => 'a brand new password']);
$newCode = (string) ($r['body']['recoveryCode'] ?? '');
check($r['status'] === 200 && $newCode !== '' && $newCode !== $recovery, 'the recovery code sets a new password and is replaced', $r['body']);
$r = $admin->call('GET', 'journals');
check($r['status'] === 401, 'and signs the old sessions out', $r['body']);
$r = $stranger->call('POST', 'auth/recover', ['username' => 'eddie', 'recoveryCode' => $recovery, 'next' => 'yet another password']);
check($r['status'] === 401, 'an old code works only once', $r['body']);
$r = $stranger->call('POST', 'auth/recover', ['username' => 'eddie', 'recoveryCode' => $config['admin_reset_token'], 'next' => 'the reset password']);
check($r['status'] === 200 && ($r['body']['recoveryCode'] ?? '') !== '', 'config.php\'s reset token also works on the recovery screen', $r['body']);
$r = $stranger->call('POST', 'auth/recover', ['username' => 'eddie', 'recoveryCode' => $config['admin_reset_token'], 'next' => 'and again password']);
check($r['status'] === 401, 'but only once', $r['body']);
$stranger->refreshCsrf();
$r = $stranger->call('POST', 'auth/login', ['username' => 'eddie', 'password' => 'the reset password']);
check($r['status'] === 200, 'and the new password signs in', $r['body']);
$stranger->call('POST', 'auth/logout');

echo "Signing out\n";
$admin->refreshCsrf();
$r = $admin->call('POST', 'auth/login', ['username' => 'eddie', 'password' => 'the reset password']);
$admin->csrf = (string) ($r['body']['csrf'] ?? '');
$r = $admin->call('POST', 'auth/logout');
$r2 = $admin->call('GET', 'journals');
check($r['status'] === 200 && $r2['status'] === 401, 'signing out ends the session', $r2['body']);

echo "Housekeeping\n";
putenv('HONEYLEAF_CONFIG=' . $configFile);
require $repo . '/server/private/src/bootstrap.php';
$pdo->exec("UPDATE pages SET deleted_at = '2000-01-01 00:00:00' WHERE deleted_at IS NULL LIMIT 1");
$app = new Honeyleaf\App($repo . '/server/private');
$done = Honeyleaf\Cleanup::run($app);
check(($done['pages'] ?? 0) >= 1, 'old trash is emptied by the cleanup job', $done);

proc_terminate($server);
echo "\n" . ($failures === 0 ? "All $passes checks passed." : "$failures of " . ($passes + $failures) . ' checks FAILED.') . "\n";
exit($failures === 0 ? 0 : 1);
