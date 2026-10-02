<script>
	export let haveDate = false;
	let fName = "";
	let lName = "";
	let email = "";
	let subject = "";
	let message = "";
	$: fullName = `${fName} ${lName}`;
	let date = new Date().toISOString().split("T")[0];
	$: emailBody = encodeURIComponent(`Email From ${email} 
	Hi McKenzie, I am ${fullName} 
	${!haveDate ? "" : `I want a breathwork Session on :${date}`}
	--------------------
	${message}
	`);
	const sendEmail = () => {
		if (fName && lName && email && subject && message) {
			window.location.href = `mailto:mckenzie@well-vie.com?subject=${subject}&body=${emailBody}`;
		} else {
			alert("Please fill out all fields");
		}
	};
</script>

<form
	class="slide"
	id="contact"
	on:submit|preventDefault={() => {
		console.log("submit");
		sendEmail();
	}}
>
	<label for="fName"
		>First Name:
		<input type="text" id="fName" bind:value={fName} required />
	</label>

	<label for="lName"
		>Last Name:
		<input type="text" id="lName" bind:value={lName} required />
	</label>

	<label for="email"
		>Email:
		<input
			type="email"
			id="email"
			bind:value={email}
			required
			autocomplete="email"
		/>
	</label>

	<label for="subject"
		>Subject:
		<input type="text" id="subject" bind:value={subject} required />
	</label>

	{#if haveDate}
		<label for="date"
			>Event date or tentative date:
			<input type="date" id="date" bind:value={date} required />
		</label>
	{/if}

	<label for="message"
		>Message:
		<textarea id="message" bind:value={message} required></textarea>
	</label>

	<button href={`mailto:<REPLACE@EMAIL>?subject=${subject}&body=${emailBody}`}
		>Work With Us
	</button>
</form>

<style>
	form {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 30px;
		max-width: 1200px;
		margin: 0 auto;

		@media (width <= 600px) {
			grid-template-columns: 1fr;
		}
	}

	label {
		color: var(--text-color);
		font-family: var(--roslindale);
		font-size: var(--heading-paragraph);
	}

	input,
	textarea {
		width: 100%;
		padding: 20px;
		min-height: 60px;
		border-radius: 8px;
		border: 2px solid var(--fg-light-color);
		background-color: var(--bg-color);
		opacity: 0.5;
		margin-top: 30px;
		font-size: var(--paragraph);
		font-family: var(--gt-walsheim);
		color: var(--text-color);

		&:focus {
			outline: none;
			border-color: var(--fg-color);
			opacity: 1;
		}
	}

	button {
		grid-column: 1 / -1;
		justify-self: center;
	}

	label[for="message"] {
		grid-column: 1 / -1;

		& textarea {
			min-height: 200px;
			min-width: 100%;
			resize: vertical;
		}
	}

	label:has(input[type="date"]),
	input:last-of-type {
		grid-column: 1 / -1;
		justify-self: center;
		min-width: 50%;
		text-align: center;

		@media (width <= 768px) {
			min-width: 100%;
		}
	}

	input:last-of-type {
		font-size: var(--paragraph);
	}
</style>
