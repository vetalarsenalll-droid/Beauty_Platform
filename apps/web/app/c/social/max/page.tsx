import Script from "next/script";
import MaxWebAppClient from "./max-webapp-client";

export default function MaxSocialAuthPage() {
  return (
    <>
      <Script src="https://st.max.ru/js/max-web-app.js" strategy="beforeInteractive" />
      <MaxWebAppClient />
    </>
  );
}
