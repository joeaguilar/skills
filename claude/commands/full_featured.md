# Claude AI Feature Request
> Execute each task in the order given to capture user input as a feature request to generate a PRD and then implement the feature.

## Task 1: Create planning directory

Create a planning directory at the root of the project if it doesnt already exist.

## Task 2: Summarize user request

Given the context of the project, summarize this user request as a feature request:

	<user_request>
	$ARGUMENTS
	</user_request>

Prompt the user if you have additional questions.

## Task 3: create summary.md:

 Create a summary the user request.
 Create a directory inside of the planning directory based on a shortname for the request.
 Save the original user request inside request.md

## Task 4: create prd.md:

Based on all of the data gathered, create a PRD for the engineering work to implement the feature request into the project. Focus specifically on the requirements in the code and less on the external factors. Follow this guideline ofr the PRD:

You **MUST include** the following in the PRD:
	- A testing plan that outlines a generic plan to test this feature
	- An optimal implentation with details
	- A guide with the best practice of how to implement this feature

**DO NOT INCLUDE**:
	- Team Estimates
	- Cost factors
	- Implementation timelines.

Perform a RISK assessment using emoji to convey severity.

Each risk should be an item in a table.
Risks would include things like:
	- security concerns i.e. a suggested library might have been involved in a recent data breach or exploit.
	- inclusion of libraries that are out of date
	- usage of functions like eval that are known to be problematic
	- updating or changing fields that might expose sensitive data

This list is non-exhaustive, it should also include anything else to be concerned about not included above.

## Task 5: Implement the feature.

You are a software engineer proficient in the technologies of this project.

You like to write code in the styles of the coding_style_guides.md, this is why you were hired.

**Think hard** and following the coding_style_guide.md, come up with a plan to implement the changes. 

Before you make any change, provide a thoughts and reasoning in thoughts.md

Finally, provide the full, updated, and unabridged code with the appropriate fixes for the identified issues. Remember:

	Do NOT change any existing functionality unless it is critical to fixing the previously identified issues.

	Only make changes that directly address the identified issues or significantly improve the code based on your analysis and the insights from Perplexity.

	Ensure that all original functionality remains intact.

## Task 6: Run the test

Run the unit test to ensure the new code didn't break any existing features. 

For broken tests follow this advice: 
	- If another module's test break, its most likely this code that break it and is what needs to change. If it is pertinent that the module change, the put the proposed changes into proposal.md along with all the relevant data to convince stakeholders of why this change needs to occur.
	- If this module's test break, determine whether test need to be or the module, updated and add to updated.md before changing anything.

Once all test pass consider this workflow complete! Yay! ^^ :champagne: