type FormType = "reset_application" | "ecosystem_waitlist";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const recipientEmail = Deno.env.get("WELL_VIE_RECIPIENT_EMAIL");
const fromEmail =
	Deno.env.get("RESEND_FROM_EMAIL") ?? "Well-Vie <hello@well-vie.com>";

const allowedOrigins = (
	Deno.env.get("WELL_VIE_ALLOWED_ORIGINS") ??
	"https://well-vie-ecosystem-preview.surge.sh,https://www.well-vie.com"
)
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

const defaultSiteOrigin = allowedOrigins[0];

const confirmationCopy = {
	reset_application: {
		subject: "We've received your Reset application",
		heading: "Thank You for Sharing",
		body: [
			"Thank you for taking the time to complete this questionnaire.",
			"We intentionally keep our spaces intimate to ensure every woman feels supported and aligned with the experience.",
			"We'll personally review your application and follow up with next steps within 2-3 business days.",
			"We look forward to getting to know you and welcoming you to Well-Vie.",
		],
	},
	ecosystem_waitlist: {
		subject: "You're on The Ecosystem waitlist",
		heading: "You're on the Waitlist",
		body: [
			"Thank you for joining The Ecosystem waitlist.",
			"You've been added to the Path II waitlist, and you'll be the first to hear when applications open for January 2027.",
		],
	},
} satisfies Record<FormType, { subject: string; heading: string; body: string[] }>;

const notificationSubjects: Record<FormType, string> = {
	reset_application: "New Reset Application",
	ecosystem_waitlist: "New Path II Waitlist",
};

const allowedRedirectPaths: Record<FormType, string> = {
	reset_application: "/reset/application-confirmation/",
	ecosystem_waitlist: "/ecosystem/waitlist-confirmation/",
};

Deno.serve(async (req) => {
	if (req.method === "OPTIONS") {
		return new Response(null, { headers: corsHeaders(req) });
	}

	if (req.method !== "POST") {
		return jsonResponse({ error: "Method not allowed" }, 405);
	}

	try {
		if (!resendApiKey) {
			throw new Error("Missing RESEND_API_KEY secret");
		}

		if (!recipientEmail) {
			throw new Error("Missing WELL_VIE_RECIPIENT_EMAIL secret");
		}

		const formData = await req.formData();
		const formType = String(formData.get("form_type") ?? "") as FormType;

		if (!isFormType(formType)) {
			return jsonResponse({ error: "Invalid form type" }, 400);
		}

		const redirectUrl = getSafeRedirectUrl(
			String(formData.get("redirect_url") ?? ""),
			formType,
		);

		if (String(formData.get("_honey") ?? "").trim()) {
			return redirect(redirectUrl);
		}

		const payload = collectPayload(formData);
		const email = String(payload.email ?? "").trim();

		if (!isValidEmail(email)) {
			return jsonResponse({ error: "A valid email address is required" }, 400);
		}

		await Promise.all([
			sendEmail({
				to: recipientEmail,
				subject: notificationSubjects[formType],
				html: renderNotificationEmail(formType, payload),
				text: renderNotificationText(formType, payload),
				replyTo: email,
			}),
			sendEmail({
				to: email,
				subject: confirmationCopy[formType].subject,
				html: renderConfirmationEmail(formType),
				text: renderConfirmationText(formType),
			}),
		]);

		return redirect(redirectUrl);
	} catch (error) {
		console.error(error);
		return jsonResponse(
			{ error: "There was a problem sending the form. Please try again." },
			500,
		);
	}
});

function collectPayload(formData: FormData): Record<string, string | string[]> {
	const skipFields = new Set(["form_type", "redirect_url", "_honey"]);
	const payload: Record<string, string | string[]> = {};

	for (const [key, value] of formData.entries()) {
		if (skipFields.has(key)) continue;

		const nextValue = String(value).trim();
		if (!nextValue) continue;

		const current = payload[key];
		if (Array.isArray(current)) {
			current.push(nextValue);
		} else if (current) {
			payload[key] = [current, nextValue];
		} else {
			payload[key] = nextValue;
		}
	}

	return payload;
}

async function sendEmail({
	to,
	subject,
	html,
	text,
	replyTo,
}: {
	to: string;
	subject: string;
	html: string;
	text: string;
	replyTo?: string;
}) {
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${resendApiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: fromEmail,
			to,
			subject,
			html,
			text,
			reply_to: replyTo,
		}),
	});

	if (!response.ok) {
		throw new Error(`Resend failed: ${response.status} ${await response.text()}`);
	}
}

function renderNotificationEmail(
	formType: FormType,
	payload: Record<string, string | string[]>,
) {
	const title = notificationSubjects[formType];
	const rows = Object.entries(payload)
		.map(([key, value]) => {
			const renderedValue = Array.isArray(value) ? value.join(", ") : value;
			return `
				<tr>
					<th>${escapeHtml(key)}</th>
					<td>${escapeHtml(renderedValue).replaceAll("\n", "<br />")}</td>
				</tr>
			`;
		})
		.join("");

	return emailShell({
		preheader: title,
		content: `
			<div class="card-brand">Well-Vie</div>
			<h1>${escapeHtml(title)}</h1>
			<p class="eyebrow">New Submission</p>
			<p class="lede">A new Well-Vie form response came through. Reply directly to this email to follow up with the sender.</p>
			<table class="response-table">${rows}</table>
		`,
	});
}

function renderNotificationText(
	formType: FormType,
	payload: Record<string, string | string[]>,
) {
	const lines = Object.entries(payload).map(([key, value]) => {
		const renderedValue = Array.isArray(value) ? value.join(", ") : value;
		return `${key}: ${renderedValue}`;
	});

	return `${notificationSubjects[formType]}\n\n${lines.join("\n")}`;
}

function renderConfirmationEmail(formType: FormType) {
	const copy = confirmationCopy[formType];
	const body = copy.body.map((line) => `<p>${escapeHtml(line)}</p>`).join("");

	return emailShell({
		preheader: copy.subject,
		content: `
			<div class="card-brand">Well-Vie</div>
			<p class="eyebrow">Well-Vie Team</p>
			<h1>${escapeHtml(copy.heading)}</h1>
			<div class="copy">${body}</div>
			<div class="signature">
				<p>With love,<br /><span>The Well-Vie Team</span></p>
			</div>
		`,
	});
}

function renderConfirmationText(formType: FormType) {
	const copy = confirmationCopy[formType];
	return `${copy.heading}\n\n${copy.body.join("\n\n")}\n\nWith love,\nThe Well-Vie Team`;
}

function emailShell({
	preheader,
	content,
}: {
	preheader: string;
	content: string;
}) {
	return `
		<!doctype html>
		<html>
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<style>
					body {
						margin: 0;
						background: #f6fbfa;
						color: #928581;
						font-family: Arial, Helvetica, sans-serif;
					}
					.wrap {
						max-width: 700px;
						margin: 0 auto;
						padding: 44px 24px;
					}
					.preheader {
						display: none;
						max-height: 0;
						overflow: hidden;
						opacity: 0;
						color: transparent;
					}
					.card {
						border: 1px solid #d3dfcf;
						border-radius: 22px;
						background: #fbffff;
						padding: 42px;
						box-shadow: 0 22px 60px rgba(112, 139, 94, 0.08);
					}
					.card-brand {
						margin: 0 0 10px;
						color: #708b5e;
						font-family: Georgia, "Times New Roman", serif;
						font-size: 24px;
						font-weight: 400;
						line-height: 1;
					}
					.eyebrow {
						margin: 0 0 14px;
						color: #708b5e;
						letter-spacing: 0.16em;
						text-transform: uppercase;
						font-size: 12px;
						font-weight: 700;
					}
					h1 {
						margin: 0 0 24px;
						color: #708b5e;
						font-family: Georgia, "Times New Roman", serif;
						font-size: 42px;
						font-weight: 400;
						line-height: 1.04;
					}
					p {
						margin: 0 0 18px;
						font-size: 16px;
						line-height: 1.7;
					}
					.lede {
						max-width: 560px;
					}
					.copy {
						padding: 4px 0 8px;
					}
					.signature {
						margin-top: 18px;
						padding-top: 24px;
						border-top: 1px solid #e8eee6;
					}
					.signature p {
						margin-bottom: 0;
					}
					.signature span {
						color: #708b5e;
						font-weight: 700;
					}
					.response-table {
						width: 100%;
						border-collapse: collapse;
						margin-top: 24px;
					}
					th,
					td {
						padding: 14px 0;
						border-bottom: 1px solid #e8eee6;
						text-align: left;
						vertical-align: top;
						font-size: 15px;
						line-height: 1.5;
					}
					th {
						width: 34%;
						color: #708b5e;
						font-weight: 700;
						padding-right: 20px;
					}
					td {
						color: #928581;
					}
					@media screen and (max-width: 560px) {
						.wrap {
							padding: 28px 14px;
						}
						.card {
							padding: 28px 22px;
							border-radius: 18px;
						}
						h1 {
							font-size: 36px;
						}
						th,
						td {
							display: block;
							width: 100%;
							padding: 10px 0;
						}
						th {
							border-bottom: 0;
							padding-bottom: 2px;
						}
					}
				</style>
			</head>
			<body>
				<div class="preheader">${escapeHtml(preheader)}</div>
				<div class="wrap">
					<div class="card">${content}</div>
				</div>
			</body>
		</html>
	`;
}

function getSafeRedirectUrl(rawRedirectUrl: string, formType: FormType) {
	const fallback = new URL(
		allowedRedirectPaths[formType],
		defaultSiteOrigin,
	).toString();

	try {
		const url = new URL(rawRedirectUrl || fallback);
		const allowedPath = allowedRedirectPaths[formType];

		if (allowedOrigins.includes(url.origin) && url.pathname === allowedPath) {
			return url.toString();
		}
	} catch {
		// Fall through to fallback.
	}

	return fallback;
}

function isFormType(value: string): value is FormType {
	return value === "reset_application" || value === "ecosystem_waitlist";
}

function isValidEmail(value: string) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function redirect(location: string) {
	return new Response(null, {
		status: 303,
		headers: {
			...corsHeaders(),
			Location: location,
		},
	});
}

function jsonResponse(body: unknown, status: number) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			...corsHeaders(),
			"Content-Type": "application/json",
		},
	});
}

function corsHeaders(req?: Request) {
	const requestOrigin = req?.headers.get("Origin") ?? "";
	const origin = allowedOrigins.includes(requestOrigin)
		? requestOrigin
		: defaultSiteOrigin;

	return {
		"Access-Control-Allow-Origin": origin,
		"Access-Control-Allow-Headers": "authorization, content-type",
		"Access-Control-Allow-Methods": "POST, OPTIONS",
	};
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#039;");
}
