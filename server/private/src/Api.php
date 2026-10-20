<?php

declare(strict_types=1);

namespace Honeyleaf;

/** The API's front door: routes each request to its handler (docs/API.md). */
final class Api
{
    public static function handle(string $privateDir, string $route): void
    {
        try {
            $app = new App($privateDir);
            $req = Request::fromGlobals($route, (bool) ($app->config['trust_proxy_https'] ?? false));
            (new self($app, $req))->dispatch();
        } catch (HttpError $e) {
            Response::error($e);
        } catch (\Throwable $e) {
            error_log('Honeyleaf: ' . $e::class . ': ' . $e->getMessage() . ' at ' . $e->getFile() . ':' . $e->getLine());
            if (!headers_sent()) {
                Response::error(new HttpError(500, 'server_error', 'Something went wrong on the server.'));
            }
        }
    }

    private Auth $auth;

    public function __construct(private readonly App $app, private readonly Request $req)
    {
        $this->auth = new Auth($app, $req);
    }

    private function dispatch(): void
    {
        $m = $this->req->method;
        $r = $this->req->route;
        if ($m === 'HEAD') {
            $m = 'GET';
        }

        // Routes that work before the database is ready.
        if ($m === 'GET' && $r === 'health') {
            Response::json(['ok' => true, 'version' => HONEYLEAF_VERSION]);
            return;
        }
        if (str_starts_with($r, 'setup/')) {
            (new SetupApi($this->app, $this->req, $this->auth))->handle($m, substr($r, 6));
            return;
        }
        if ($m === 'GET' && $r === 'session') {
            $this->session();
            return;
        }

        if (!$this->app->tablesReady()) {
            throw new HttpError(503, 'setup_required', 'Honeyleaf is not set up yet.');
        }
        Migrator::upgrade($this->app);
        Cleanup::maybe($this->app);

        $this->auth->load(true);
        if ($m !== 'GET') {
            $this->auth->checkCsrf();
        }

        $seg = $r === '' ? [] : explode('/', $r);
        $head = $seg[0] ?? '';
        $handler = match ($head) {
            'auth' => new AuthApi($this->app, $this->req, $this->auth),
            'admin' => new AdminApi($this->app, $this->req, $this->auth),
            'journals' => new JournalApi($this->app, $this->req, $this->auth),
            'entries' => new EntryApi($this->app, $this->req, $this->auth),
            'assets' => new AssetApi($this->app, $this->req, $this->auth),
            'trash' => new TrashApi($this->app, $this->req, $this->auth),
            'settings' => new SettingsApi($this->app, $this->req, $this->auth),
            'export' => new ExportApi($this->app, $this->req, $this->auth),
            default => throw HttpError::notFound(),
        };
        $handler->handle($m, array_slice($seg, 1));
    }

    /** GET session: always 200; tells the client which screen to show. */
    private function session(): void
    {
        $server = [
            'version' => HONEYLEAF_VERSION,
            'maxUploadBytes' => $this->app->cfgInt('max_upload_bytes'),
            'trashDays' => $this->app->cfgInt('trash_days'),
        ];
        // No config, no tables or no admin yet: the setup wizard.
        if (!$this->app->configFound || $this->app->cfgStr('db_name') === '' || !$this->app->tablesReady()) {
            Response::json(['state' => 'setup', 'csrf' => '', 'server' => $server]);
            return;
        }
        Migrator::upgrade($this->app);
        if (!SetupApi::adminExists($this->app)) {
            Response::json(['state' => 'setup', 'csrf' => '', 'server' => $server]);
            return;
        }
        $this->auth->load(false);
        $out = ['state' => $this->auth->state(), 'csrf' => $this->auth->csrfToken(), 'server' => $server];
        if ($this->auth->user !== null) {
            $u = $this->auth->user;
            $out['user'] = Auth::publicUser($u);
        }
        Response::json($out);
    }
}
