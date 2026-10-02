import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readProjectFile(path) {
	return readFileSync(resolve(root, path), "utf8");
}

test("reset application form submits Path I applications through the Supabase form endpoint", () => {
	const page = readProjectFile("src/pages/reset/apply.astro");
	const form = readProjectFile("src/components/ResetApplicationForm.astro");
	const normalized = form.replace(/\s+/g, " ");

	assert.match(page, /<ResetApplicationForm \/>/);
	assert.match(form, /action=\{formEndpoint\}/);
	assert.match(form, /PUBLIC_WELL_VIE_FORM_ENDPOINT/);
	assert.match(form, /aybrcwtmggiwyzfpwfil\.supabase\.co\/functions\/v1\/well-vie-forms/);
	assert.match(form, /name="form_type"\s+value="reset_application"/);
	assert.match(form, /name="redirect_url"\s+value=\{confirmationUrl\}/);
	assert.doesNotMatch(form, /formsubmit\.co/);
	assert.doesNotMatch(form, /name="_subject"/);
	assert.doesNotMatch(form, /name="_template"/);
	assert.doesNotMatch(form, /name="_next"/);
	assert.doesNotMatch(form, /name="_autoresponse"/);
	assert.doesNotMatch(form, /name="_captcha"\s+value="false"/);
	assert.match(form, /name="Full Name"/);
	assert.match(form, /name="email"/);
	assert.match(form, /name="Age"/);
	assert.match(form, /name="Location"/);
	assert.match(form, /Just beginning/);
	assert.match(form, /I've done some personal growth work/);
	assert.match(form, /I've been actively healing for several years/);
	assert.match(form, /Nervous system support/);
	assert.match(form, /Emotional healing/);
	assert.match(form, /Community and connection/);
	assert.match(form, /Confidence and self-trust/);
	assert.match(form, /Breathwork practices/);
	assert.match(form, /Yes, regularly/);
	assert.match(form, /A few times/);
	assert.match(form, /No, I'm completely new/);
	assert.match(form, /Stress or burnout/);
	assert.match(form, /Anxiety or depression/);
	assert.match(form, /Life transitions or navigating a new home or country/);
	assert.match(form, /Navigating leadership, entrepreneurship, or career growth/);
	assert.match(normalized, /What kind of support are you looking for right now\?/);
	assert.match(normalized, /What are you hoping life feels like on the other side of this work\?/);
	assert.match(normalized, /Why does now feel like the right time for you\?/);
	assert.match(normalized, /Is there anything else you'd like us to know\?/);
});

test("path ii waitlist form submits through the Supabase form endpoint", () => {
	const ecosystem = readProjectFile("src/pages/ecosystem.astro");
	const form = readProjectFile("src/components/EcosystemWaitlistForm.astro");
	const normalized = form.replace(/\s+/g, " ");

	assert.match(ecosystem, /import EcosystemWaitlistForm/);
	assert.match(ecosystem, /<EcosystemWaitlistForm \/>/);
	assert.match(ecosystem, /href="#path-ii-waitlist" class="btn">Join the Waitlist<\/a>/);
	assert.doesNotMatch(ecosystem, /pathTwoWaitlistLink/);
	assert.doesNotMatch(ecosystem, /Path%20II%20Waitlist/);
	assert.match(form, /id="path-ii-waitlist"/);
	assert.match(form, /action=\{formEndpoint\}/);
	assert.match(form, /PUBLIC_WELL_VIE_FORM_ENDPOINT/);
	assert.match(form, /aybrcwtmggiwyzfpwfil\.supabase\.co\/functions\/v1\/well-vie-forms/);
	assert.match(form, /name="form_type"\s+value="ecosystem_waitlist"/);
	assert.match(form, /name="redirect_url"\s+value=\{confirmationUrl\}/);
	assert.doesNotMatch(form, /formsubmit\.co/);
	assert.doesNotMatch(form, /name="_subject"/);
	assert.doesNotMatch(form, /name="_template"/);
	assert.doesNotMatch(form, /name="_next"/);
	assert.doesNotMatch(form, /name="_autoresponse"/);
	assert.doesNotMatch(form, /name="_captcha"\s+value="false"/);
	assert.match(form, /name="First Name"/);
	assert.match(form, /name="Last Name"/);
	assert.match(form, /name="email"/);
	assert.match(form, /name="Country"/);
	assert.match(normalized, /What are you hoping to gain from The Ecosystem\?/);
});

test("Supabase Edge Function sends branded Resend emails and redirects to local confirmation pages", () => {
	const source = readProjectFile("supabase/functions/well-vie-forms/index.ts");
	const envExample = readProjectFile(".env.example");
	const supabaseConfig = readProjectFile("supabase/config.toml");

	assert.match(source, /Deno\.env\.get\("RESEND_API_KEY"\)/);
	assert.match(source, /Deno\.env\.get\("WELL_VIE_RECIPIENT_EMAIL"\)/);
	assert.match(source, /Deno\.env\.get\("RESEND_FROM_EMAIL"\)/);
	assert.match(source, /Well-Vie <hello@well-vie\.com>/);
	assert.doesNotMatch(source, /onboarding@resend\.dev/);
	assert.match(source, /Deno\.env\.get\("WELL_VIE_ALLOWED_ORIGINS"\)/);
	assert.match(source, /https:\/\/well-vie-ecosystem-preview\.surge\.sh,https:\/\/www\.well-vie\.com/);
	assert.match(source, /allowedOrigins\.includes\(url\.origin\)/);
	assert.match(source, /allowedOrigins\.includes\(requestOrigin\)/);
	assert.match(source, /Missing WELL_VIE_RECIPIENT_EMAIL secret/);
	assert.match(source, /https:\/\/api\.resend\.com\/emails/);
	assert.match(source, /reset_application/);
	assert.match(source, /ecosystem_waitlist/);
	assert.match(source, /renderConfirmationEmail/);
	assert.match(source, /renderNotificationEmail/);
	assert.match(source, /card-brand/);
	assert.match(source, /<div class="card-brand">Well-Vie<\/div>\s*<h1>\$\{escapeHtml\(title\)\}<\/h1>/);
	assert.doesNotMatch(source, /class="brand-mark"/);
	assert.doesNotMatch(source, /New Reset Application - Well-Vie/);
	assert.doesNotMatch(source, /New Path II Waitlist - Well-Vie/);
	assert.match(source, /box-shadow: 0 22px 60px rgba\(112, 139, 94, 0\.08\)/);
	assert.match(source, /font-family: Georgia, "Times New Roman", serif/);
	assert.doesNotMatch(source, /A soft place to reconnect, breathe, and feel held\./);
	assert.doesNotMatch(source, /class="footer"/);
	assert.match(source, /Reply directly to this email to follow up with the sender\./);
	assert.match(source, /status: 303/);
	assert.match(source, /\/reset\/application-confirmation\//);
	assert.match(source, /\/ecosystem\/waitlist-confirmation\//);
	assert.doesNotMatch(source, /formsubmit\.co/);
	assert.doesNotMatch(source, /RESEND_API_KEY\s*=\s*["']/);
	assert.match(envExample, /PUBLIC_WELL_VIE_FORM_ENDPOINT=https:\/\/aybrcwtmggiwyzfpwfil\.supabase\.co\/functions\/v1\/well-vie-forms/);
	assert.match(supabaseConfig, /\[functions\.well-vie-forms\]/);
	assert.match(supabaseConfig, /verify_jwt = false/);
});

test("form confirmation pages preserve the Well-Vie confirmation copy", () => {
	const resetConfirmation = readProjectFile("src/pages/reset/application-confirmation.astro");
	const waitlistConfirmation = readProjectFile("src/pages/ecosystem/waitlist-confirmation.astro");
	const normalizedReset = resetConfirmation.replace(/\s+/g, " ");
	const normalizedWaitlist = waitlistConfirmation.replace(/\s+/g, " ");

	assert.match(normalizedReset, /Thank you for taking the time to complete this questionnaire\./);
	assert.match(normalizedReset, /We intentionally keep our spaces intimate to ensure every woman feels supported and aligned with the experience\./);
	assert.match(normalizedReset, /We'll personally review your application and follow up with next steps within 2-3 business days\./);
	assert.match(normalizedReset, /With love,<br \/> The Well-Vie Team/);
	assert.match(normalizedWaitlist, /You've been added to the Path II waitlist\./);
	assert.match(normalizedWaitlist, /you'll be the first to hear when applications open/);
});

test("application and waitlist forms avoid focus layout shifts from global input styles", () => {
	const resetForm = readProjectFile("src/components/ResetApplicationForm.astro");
	const waitlistForm = readProjectFile("src/components/EcosystemWaitlistForm.astro");

	for (const form of [resetForm, waitlistForm]) {
		assert.match(form, /input,\s*\n\ttextarea\s*{[^}]*box-sizing: border-box;[^}]*margin: 0;[^}]*opacity: 1;/s);
		assert.match(form, /input:focus,\s*\n\ttextarea:focus\s*{[^}]*outline: none;[^}]*box-shadow: 0 0 0 3px rgba\(112, 139, 94, 0\.16\);/s);
		assert.doesNotMatch(form, /outline-offset: 2px/);
	}
});

test("forms do not render input cards inside outer field cards", () => {
	const resetForm = readProjectFile("src/components/ResetApplicationForm.astro");
	const waitlistForm = readProjectFile("src/components/EcosystemWaitlistForm.astro");

	for (const form of [resetForm, waitlistForm]) {
		assert.match(form, /\.field\s*{[^}]*padding: 0;[^}]*border: 0;[^}]*background-color: transparent;[^}]*box-shadow: none;/s);
		assert.match(form, /\.field:focus-within\s*{[^}]*background-color: transparent;[^}]*box-shadow: none;/s);
	}

	assert.match(resetForm, /\.other-field:focus-within\s*{[^}]*background-color: transparent;[^}]*box-shadow: none;/s);
	assert.match(resetForm, /\.other-field span\s*{[^}]*font-family: var\(--gt-walsheim\);[^}]*font-size: 0\.95rem;/s);
});

test("waitlist form uses consistent vertical gaps between fields", () => {
	const waitlistForm = readProjectFile("src/components/EcosystemWaitlistForm.astro");

	assert.match(waitlistForm, /\.waitlist-form\s*{[^}]*gap: 1\.5rem;/s);
	assert.match(waitlistForm, /\.field-grid\s*{[^}]*gap: 1\.5rem;/s);
});

test("reset application option controls align with their labels", () => {
	const resetForm = readProjectFile("src/components/ResetApplicationForm.astro");

	assert.match(resetForm, /\.options label\s*{[^}]*align-items: center;/s);
	assert.match(resetForm, /\.options label span\s*{[^}]*line-height: 1\.12;/s);
	assert.match(resetForm, /\.options input\s*{[^}]*flex: 0 0 1\.15rem;[^}]*height: 1\.15rem;[^}]*margin: 0;[^}]*transform: translateY\(1px\);/s);
	assert.match(resetForm, /\.checkbox-grid\s*{[^}]*row-gap: 1rem;/s);
	assert.match(resetForm, /\.checkbox-grid label\s*{[^}]*align-items: flex-start;/s);
	assert.match(resetForm, /\.checkbox-grid input\s*{[^}]*transform: translateY\(0\.42rem\);/s);
	assert.doesNotMatch(resetForm, /margin-top: 0\.2rem/);
});
