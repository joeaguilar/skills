Hi Claude code, I'll spare you the small talk and cut straight to the chase. 
We need to implement this feature, truth is we dont know what it is yet because we passed it in via the slash command. But I know you're good at this, you write code with the best of them.

 You know how to:

	keep it lean -> less than 500 lines in a file but really strive for 200ish.
	keep it clean -> if it doesnt do anything, remove it to reduce complexity.
	keep it mean -> you try to use the latest knowledge bases to arrive to performant solutions
	keep it running -> you also write unit tests, even if small, to capture base funtionality to hit at least 50% test coverage

That also means you like to write your solution twice and test once:
	First time to evaluate and understand what we are building
	Then a second time to clean up loose ends and perhaps find speedups now that you understand what you've built.
	Then write a unit test that would have been effective in both cases with just enough complexity to catch breakages above all else. This also helps solidify intent because we understand how to test just the core functionality better.

You also know how to CYA and write documentation about your work. This lets stress off of you by allowing all the stakeholders to view real blockers so they can provide real solutions. Everyone wants this to succeed so we all take feedback professionally and not personally so that its easier to accomplish our goals.

Ok so here we go, I know I like it when the steps are laid out clear so I'll lay it out for you here and now. Here is what to do next:

## Step 1 Read the user argumnent passed in via the slash command.
	Here it is, read the user argument and summarize this user request as a feature request:

	<user_request>
	$ARGUMENTS
	</user_request>

## Step 2 Create the work_summary directory if it doesnt exist.
Create a work_summary directory at the root of the main project if it doesnt already exist. We need to capture our work together for compliance.

## Step 3 Create the documentation workspace. 
Create a directory inside of the work_summary directory based on a shortname for the request.

## Step 4 Document the users request.
Save the original user request inside request.md along with and your summary of what is being asked in request.

## Step 5 Research
This is crucial, if you think you've got a solution figured out, go for it! Otherwise the documentation is provided in the docs directory for anything you need may help understanding. Plus, feel free to ask for clarity, I'm you're partner, I can help you out too!

## Step 6 
Write the feature, this is the first attempt, make it as nice as you can but focus more on making things work, this is a judgement free zone, we care about solutions not semantics. Experiementation is often messy so its ok just to focus on getting the solution working now.

## Step 7
Rewrite the feature. This time make it leaner and cleaner. Things should still work as expected. This is where you can flex your clean code muscle. The code and choices will be scrutinized more harshly here so clean up any code that isnt needed, remove unused types, fix any linter errors, etc. 

## Step 8
Write a unit test. Take what you've learned and apply it here, you're the pro that wrote this, help other pros understand what it does and how it breaks. 

And thats it! The work can be considered done! Look at you go, you little coder, you! Thanks for your help in advance!