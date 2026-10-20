import { AuthDesk } from './AuthDesk';
import { ChangePasswordCard } from './ChangePassword';
import { ClosedJournal } from './ClosedJournal';
import s from './auth.module.css';

/** First sign-in with a temporary password: choose your own before the diary opens. */
export function ChangePasswordScreen() {
  return (
    <AuthDesk>
      <ClosedJournal state="shut" />
      <div className={s.besideJournal}>
        <ChangePasswordCard />
      </div>
    </AuthDesk>
  );
}
