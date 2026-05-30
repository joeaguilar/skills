# Claude AI Implement Feature
> Execute each task in the order given to successfully implement the feature requested in code.


## Task 1: Gain understanding

READ README.md, THEN read documentation.md to understand the context of the project.

Given the context of the project, summarize this user request as a feature request:

	<user_request>
	$ARGUMENTS
	</user_request>

THEN Find the PRD that best matches the text the user requests in the planning directory at the project root. 

If the planning directory does not exist or the summarized plan cannot be found, run the claude#feature_request workflow then return here. 

The name of the project directory is the same name that should be used for work_summary later.

## Task 2: Create work_summary directory

Create a work_summary directory at the root of the project if it doesnt already exist.


## Task 3: create summary.md:

 Create a summary the user request.
 Create a directory inside of the planning directory based on a shortname for the request.
 Save the original user request inside request.md


## Task 4: Implement the feature.

You are a software engineer proficient in the technologies of this project.

You like to write code in the styles of the coding_style_guides.md, this is why you were hired.

**Think hard** and following the coding_style_guide.md, come up with a plan to implement the changes. 

Before you make any change, provide a thoughts and reasoning in thoughts.md

Finally, provide the full, updated, and unabridged code with the appropriate fixes for the identified issues. Remember:

	Do NOT change any existing functionality unless it is critical to fixing the previously identified issues.

	Only make changes that directly address the identified issues or significantly improve the code based on your analysis and the insights from Perplexity.

	Ensure that all original functionality remains intact.

## Task 5: Run the test

Run the unit test to ensure the new code didn't break any existing features. 

For broken tests follow this advice: 
	- If another module's test break, its most likely this code that break it and is what needs to change. If it is pertinent that the module change, the put the proposed changes into proposal.md along with all the relevant data to convince stakeholders of why this change needs to occur.
	- If this module's test break, determine whether test need to be or the module, updated and add to updated.md before changing anything.

Once all test pass consider this workflow complete! Yay! ^^ :champagne: