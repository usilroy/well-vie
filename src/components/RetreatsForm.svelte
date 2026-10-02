<script>
	let fName = "";
	let lName = "";
	let email = "";
	let phone = "";

	let days = 1;
	let included = [];
	$: fullName = `${fName} ${lName}`;
	$: emailBody = encodeURIComponent(`Hi McKenzie,
		I Want to book a retreat for ${fullName}
		Email: ${email}
		Phone: ${phone}
		Amount of Days: ${days}
		${included.length > 0 ? `Included: ${included.join(", ")}` : ""}
		Thank you
	`);

	const sendEmail = () => {
		if (fName && lName && email) {
			window.location.href = `mailto:mckenzie@well-vie.com?subject=Retreat&body=${emailBody}`;
		} else {
			alert("Please fill out all fields");
		}
	};
</script>

<form
	class="slide"
	id="contact"
	on:submit|preventDefault={() => {
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

	<label for="phone"
		>Phone:
		<input type="text" id="phone" bind:value={phone} required />
	</label>

	<section>
		<label>
			<input type="number" max="7" min="1" bind:value={days} />
			Amount of Days 1-7
		</label>

		<label
			><input type="checkbox" value="Chef Included" bind:group={included} />
			Chef Included
		</label>
		<label
			><input
				type="checkbox"
				value="House/Space Included"
				bind:group={included}
			/>
			House/Space Included
		</label>
		<label
			><input
				type="checkbox"
				value="Breathwork Session"
				bind:group={included}
			/>
			Breathwork Session
		</label>
		<label
			><input type="checkbox" value="Yoga Session" bind:group={included} />
			Yoga Session
		</label>
		<label>
			<input
				type="checkbox"
				value="Sound Healing Session"
				bind:group={included}
			/>
			Sound Healing Session
		</label>
		<label>
			<input
				type="checkbox"
				value="Expert Workshop on Breathing and Nerveous"
				bind:group={included}
			/>

			Expert Workshop on Breathing and Nerveous
		</label>
		<label
			><input type="checkbox" value="System Techniques" bind:group={included} />
			System Techniques
		</label>
		<label>
			<input
				type="checkbox"
				value="Tailored Workshop with a Career or Life"
				bind:group={included}
			/>
			Tailored Workshop with a Career or Life
		</label>
		<label
			><input type="checkbox" value="Coach" bind:group={included} />
			Coach
		</label>
		<label>
			<input
				type="checkbox"
				value="Team Building Workshop"
				bind:group={included}
			/>
			Team Building Workshop
		</label>
	</section>

	<button>Submit</button>
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

	button {
		grid-column: 1 / -1;
		justify-self: center;
	}

	section {
		grid-column: 1 / -1;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin: 0 auto;
	}

	section label {
		display: flex;
		align-items: center;
		gap: 2rem;
		flex: 1;
	}

	section input[type="number"] {
		flex: 0 1 80px;
	}

	section input[type="checkbox"] {
		display: none;
	}

	section label:has(input[type="checkbox"]) {
		cursor: pointer;

		&::before {
			content: "";
			display: inline-block;
			width: 40px;
			aspect-ratio: 1/1;
			border: 1px solid var(--fg-color);
			border-radius: 100%;
			flex: 0 0 40px;

			@media (width <= 600px) {
				flex: 0 0 30px;
			}
		}
	}

	section label:has(input[type="checkbox"]):hover::before {
		background-color: var(--text-color);
	}

	section label:has(input[type="checkbox"]:checked)::before {
		background-color: var(--fg-color);
	}
</style>
