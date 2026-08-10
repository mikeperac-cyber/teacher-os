/**
 * Layout for the authentication screens.
 *
 * A route group, so `/sign-in` and `/sign-up` keep their URLs while sharing a
 * centred shell that is deliberately unlike the workspace: no sidebar, no
 * navigation, nothing to click into before there is a session.
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="auth-shell">{children}</div>;
}
