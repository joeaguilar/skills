# Claude AI Feature Request
> Execute each task in the order given to capture user input as a feature request to generate a PRD.

## Task 1: Gain understanding

READ README.md, THEN read documentation.md to understand the context of the project.


## Task 2: Create planning directory

Create a planning directory at the root of the project if it doesnt already exist.

## Task 3: Summarize user request

Given the context of the project, summarize this user request as a feature request:

	<user_request>
	$ARGUMENTS
	</user_request>


## Task 4: create summary.md:

 Create a summary the user request.
 Create a directory inside of the planning directory based on a shortname for the request.
 Save the original user request inside request.md

## Task 5: create plan.md:

Create a plan to enact the users request as plan.md.
Make sure to cross-reference 


## Task 6: create prd.md:

Based on all of the data gathered, create a PRD for the engineering work to implement the feature request into the project. Focus specifically on the requirements in the code and less on the external factors. Follow this guideline ofr the PRD:

You **MUST include** the following in the PRD:
	- A testing plan that outlines a generic plan to test this feature
	- An optimal implentation with details
	- A guide with the best practice of how to implement this feature

**DO NOT INCLUDE**:
	- Team Estimates
	- Cost factors
	- Implementation timelines.


## Task 7. create risks.md

Perform a RISK assessment using emoji to convey severity as risk.md. 

Each risk should be an item in a table.
Risks would include things like:
	- security concerns i.e. a suggested library might have been involved in a recent data breach or exploit.
	- inclusion of libraries that are out of date
	- usage of functions like eval that are known to be problematic
	- updating or changing fields that might expose sensitive data

This list is non-exhaustive, it should also include anything else to be concerned about not included above.