# BrainLift: Effortful Learning, Not Edutainment

A research-grounded design philosophy for an AP Physics learning app whose AI grades handwritten work, gives Socratic hints, and never reveals the answer. This document is written to be pasted directly into an AI conversation as curated context.

## Owners

- Adam Banks

## Purpose

### Purpose
Establish a defensible, research-backed stance for how this app should be designed: the experience should stay about as effortful as working through the physics by hand, and the AI should be aimed at making that effort more effective (faster feedback, scheduled retrieval, hints that preserve the student's own reasoning), not at making studying more enjoyable. The north star is durable learning and transfer, measured later and unaided, not in-session ease or satisfaction.

### In Scope
- Cognitive science of durable learning: desirable difficulties, retrieval and generation, the learning vs performance distinction.
- Pedagogical design decisions in the app: predict-before-reveal inquiry, worked examples with self-explanation, by-hand problem solving with AI grading and scaffolded hints.
- The role and design of AI tutoring: when assistance helps learning and when it harms it.

### Out of Scope
- Using AI to generate the insights or the stance for me; the synthesis must pass through my own brain (this is direct context, not a retrieval pipeline).
- Engagement-maximization and gamification strategy as ends in themselves.
- Curriculum content (the what), broader edtech market analysis, and the generic "screen time" debate.

## DOK 4: Spiky Point of View

- **The best educational apps should not be more fun than studying normally. Using them should feel almost like working through the material by hand, and the job of AI is to make that effortful process more effective, not more enjoyable.**
  - **Elaboration:** Durable learning is produced by effortful retrieval, generation, and doing, which feel hard and slow in the moment (Roediger and Karpicke, 2006; Slamecka and Graf, 1978; Koedinger et al., 2015; Freeman et al., 2014). The pleasant signals a product is tempted to optimize, ease and the feeling of learning, are unreliable and can run opposite to real learning (Soderstrom and Bjork, 2015; Deslauriers et al., 2019; Dunlosky et al., 2013). Worse, adding enjoyment as a layer can actively depress learning: interesting-but-irrelevant detail cuts recall and transfer (Harp and Mayer, 1998), and game mechanics lowered motivation and grades over a semester (Hanus and Fox, 2015). The same pattern governs AI: an assistant that hands over answers lifts in-session performance but leaves students worse once it is gone, while a guardrailed tutor that only gives hints does not (Bastani et al., 2025), and step-level tutoring that keeps students reasoning rivals human tutors (VanLehn, 2011). So the correct design target is not enjoyment but effectiveness: keep the student generating the work by hand, and spend AI on grading that work in seconds, scheduling retrieval as memory fades, and giving step-level hints that never remove the generation.

## Experts

Curated to disagree, so the tension is real.

- **Robert A. Bjork** (UCLA). Coined "desirable difficulties"; anchor of the effort-over-ease camp. https://bjorklab.psych.ucla.edu/publications/
- **Henry L. Roediger III and Jeffrey D. Karpicke** (Washington University in St. Louis). Retrieval practice and the testing effect. http://psychnet.wustl.edu/memory/
- **Richard E. Mayer** (UC Santa Barbara). Multimedia learning; separates helpful "cognitive interest" from harmful "emotional interest" (fun for its own sake). A measured middle voice.
- **Kenneth R. Koedinger** (Carnegie Mellon). Intelligent tutoring systems and the "doer effect"; how technology should drive doing. http://pact.cs.cmu.edu/
- **The foil: Karl Kapp and James Paul Gee.** Advocates of gamification and games-based learning who treat engagement as the primary lever. The SPOV directly contradicts this camp, which is what makes it spiky. (Kapp, *The Gamification of Learning and Instruction*, 2012; Gee, *What Video Games Have to Teach Us About Learning and Literacy*, 2003.)

## DOK 3: Insights

- **Ease is a false signal, so "feels better" usually means "the difficulty that teaches was removed."** Performance and the feeling of learning during study are unreliable, sometimes inverted, indicators of durable learning (Soderstrom and Bjork, 2015; Deslauriers et al., 2019), and the techniques students find easiest are the least effective (Dunlosky et al., 2013; Roediger and Karpicke, 2006). The design consequence no single paper states: a redesign that makes the experience feel smoother is, by default, suspect, because the smoothness is often the removed effort.

- **Fun added as a layer is not free; it competes with the learning.** Interesting-but-irrelevant "seductive details" reduce recall and transfer (Harp and Mayer, 1998), and the classic game layer of points, badges, and leaderboards reduced motivation and final grades over a semester (Hanus and Fox, 2015). Engagement bolted on top of content tends to tax the lesson rather than carry it.

- **The value is in the doing, not in the delivery.** Memory is stronger for what the learner generates than for what they are shown (Slamecka and Graf, 1978), interactive doing is roughly six times more effective than watching or reading the same material (Koedinger et al., 2015), and active engagement beats lecture across 225 studies (Freeman et al., 2014). So the product should protect the student's own production (handwritten reasoning) as the core asset, not replace it with better explanations.

- **AI's leverage is effort-preserving feedback, and that is a design choice, not a model capability.** A model that hands over answers inflates in-session performance and then lowers real learning, while the same model constrained to hints does not (Bastani et al., 2025); step-level tutoring that keeps the student reasoning rivals human tutors (VanLehn, 2011). The app's "grade the ink, hint without revealing" contract is precisely the guardrail the evidence demands.

## DOK 2: Knowledge Tree

### Category 1: The science of durable learning (why effort is the active ingredient)

**Subcategory 1.1: Learning versus performance**

- **Soderstrom and Bjork (2015), "Learning Versus Performance: An Integrative Review," *Perspectives on Psychological Science* 10(2), 176-199.**
  - **DOK 1 - Facts:** Performance (observable during training) is an unreliable index of learning (a relatively permanent change supporting retention and transfer). The two are dissociable and can be inversely related; people routinely misread current performance as a guide to long-term learning.
  - **DOK 2 - Summary:** What you can see while a student studies is a poor, sometimes backwards, signal of what they will retain. Designing for visible ease optimizes the wrong variable.
  - **Link:** https://doi.org/10.1177/1745691615569000

- **Bjork and Bjork (2011), "Making Things Hard on Yourself, but in a Good Way: Creating Desirable Difficulties to Enhance Learning," in *Psychology and the Real World*, 56-64, Worth.**
  - **DOK 1 - Facts:** "Desirable difficulties" (spacing, interleaving, retrieval, varied practice) depress short-term performance while improving long-term retention and transfer; conditions that speed apparent learning often produce fast forgetting.
  - **DOK 2 - Summary:** The right difficulties are the active ingredient, not a bug to smooth away. A frictionless tool tends to strip out the difficulty that teaches.
  - **Link:** https://bjorklab.psych.ucla.edu/publications/

**Subcategory 1.2: Retrieval and generation (effortful production)**

- **Roediger and Karpicke (2006), "Test-Enhanced Learning," *Psychological Science* 17(3), 249-255.**
  - **DOK 1 - Facts:** On a 5-minute test, restudy beat testing (SSSS 83% vs STTT 71%); after 1 week the order reversed (STTT 61% vs SSSS 40%). The testing group had read the passage 3.4 times vs 14.2 for restudy, yet recalled more at a week. Restudy raised confidence but not retention.
  - **DOK 2 - Summary:** Effortful retrieval beats passive review for durable memory, even though re-reading feels more productive and inflates confidence.
  - **Link:** https://doi.org/10.1111/j.1467-9280.2006.01693.x

- **Slamecka and Graf (1978), "The Generation Effect: Delineation of a Phenomenon," *Journal of Experimental Psychology: Human Learning and Memory* 4(6), 592-604.**
  - **DOK 1 - Facts:** Across 5 experiments (96 undergraduates), self-generated words were remembered better than the same words read, on every measure, and robustly across encoding rules, timing, and designs.
  - **DOK 2 - Summary:** Producing the answer yourself encodes it more durably than receiving it, which is exactly what an answer-revealing tool removes.
  - **Link:** https://doi.org/10.1037/0278-7393.4.6.592

**Subcategory 1.3: Active doing over passive reception**

- **Freeman et al. (2014), "Active Learning Increases Student Performance in Science, Engineering, and Mathematics," *PNAS* 111(23), 8410-8415.**
  - **DOK 1 - Facts:** Meta-analysis of 225 studies. Active learning raised exam and concept-inventory scores by 0.47 SD and cut failure rates from 33.8% (lecture) to 21.8% (active), an odds ratio of 1.95. Robust across disciplines and class sizes; not explained by publication bias.
  - **DOK 2 - Summary:** The largest STEM-education synthesis shows doing beats being told, at scale.
  - **Link:** https://www.pnas.org/doi/abs/10.1073/pnas.1319030111

- **Koedinger, Kim, Jia, McLaughlin, and Bier (2015), "Learning Is Not a Spectator Sport: Doing Is Better Than Watching for Learning From a MOOC," *Proceedings of the ACM Conference on Learning @ Scale*, 111-120.**
  - **DOK 1 - Facts:** A 1 SD increase in doing (interactive practice) predicted a 0.44 SD quiz gain, more than six times the benefit of equivalent watching or reading and more than three times their combined effect; causal-inference analysis supports doing as causal.
  - **DOK 2 - Summary:** Interactive doing is roughly six times more effective than consuming the same content passively.
  - **Link:** https://doi.org/10.1145/2724660.2724681

- **Mueller and Oppenheimer (2014), "The Pen Is Mightier Than the Keyboard," *Psychological Science* 25(6), 1159-1168.** *(use as mechanism, with a replication caveat)*
  - **DOK 1 - Facts:** Across 3 studies, longhand and laptop note-takers tied on factual recall, but longhand did better on conceptual questions; laptop notes were more verbatim (shallower processing). Caveat: direct replications (Morehead, Dunlosky, and Rawson, 2019; Urry et al., 2021) found weaker, often non-significant effects, so the robust claim is the mechanism (reframing in your own words aids conceptual learning), not the writing medium.
  - **DOK 2 - Summary:** Effortful, by-hand reformulation supports understanding better than frictionless verbatim capture; cite the mechanism, not a hard number.
  - **Link:** https://journals.sagepub.com/doi/abs/10.1177/0956797614524581

### Category 2: Why ease and fun mislead (the false-signal problem)

**Subcategory 2.1: The feeling of learning is anticorrelated with actual learning**

- **Deslauriers, McCarty, Miller, Callaghan, and Kestin (2019), "Measuring Actual Learning Versus Feeling of Learning in Response to Being Actively Engaged in the Classroom," *PNAS* 116(39), 19251-19257.**
  - **DOK 1 - Facts:** Randomized crossover in Harvard intro physics with identical content; only active engagement was toggled. Active students learned more but felt they learned less ("actual learning and feeling of learning were strongly anticorrelated"). Perceived fluency drove the feeling (about 0.51 SD higher feeling-of-learning), and the gap is attributed to extra cognitive effort being misread as poor instruction.
  - **DOK 2 - Summary:** The most direct evidence for the SPOV: enjoyment and real learning can move in opposite directions, so optimizing how much students like an experience can select for the version that teaches less.
  - **Link:** https://www.pnas.org/doi/10.1073/pnas.1821936116

- **Dunlosky, Rawson, Marsh, Nathan, and Willingham (2013), "Improving Students' Learning With Effective Learning Techniques," *Psychological Science in the Public Interest* 14(1), 4-58.**
  - **DOK 1 - Facts:** Of 10 techniques, only practice testing and distributed practice earned high utility; summarization, highlighting, the keyword mnemonic, imagery, and rereading were low utility. The low-utility ones are the most popular (84% of students at one elite university reported studying by rereading).
  - **DOK 2 - Summary:** The easy, pleasant strategies work least; the effortful ones work best. Student preference is anticorrelated with effectiveness.
  - **Link:** https://journals.sagepub.com/doi/abs/10.1177/1529100612453266

**Subcategory 2.2: Adding enjoyment as a layer can harm learning**

- **Harp and Mayer (1998), "How Seductive Details Do Their Damage: A Theory of Cognitive Interest in Science Learning," *Journal of Educational Psychology* 90(3), 414-434.**
  - **DOK 1 - Facts:** Across 4 experiments (357 undergraduates), adding interesting-but-irrelevant details to science text reduced recall of main ideas and problem-solving transfer; highlighting, objectives, and signaling did not fix it. Emotional-interest add-ons debilitate learning, while cognitive-interest ones help.
  - **DOK 2 - Summary:** Engaging-but-irrelevant material backfires; entertaining is not the same as clarifying, and it often costs comprehension.
  - **Link:** https://doi.org/10.1037/0022-0663.90.3.414

- **Hanus and Fox (2015), "Assessing the Effects of Gamification in the Classroom," *Computers and Education* 80, 152-161.**
  - **DOK 1 - Facts:** Longitudinal study (about 80 students, 16 weeks, 4 measurements); the section with a leaderboard and badges decreased in intrinsic motivation, satisfaction, and empowerment over time and scored lower on the final exam, an effect mediated by reduced intrinsic motivation.
  - **DOK 2 - Summary:** The canonical "make it a game" levers reduced motivation and grades; bolting on fun can erode the intrinsic motivation learning depends on.
  - **Link:** https://www.sciencedirect.com/science/article/abs/pii/S0360131514002000

### Category 3: Designing AI to amplify effort (the application)

**Subcategory 3.1: AI that removes effort harms learning**

- **Bastani, Bastani, Sungu, Ge, Kabakci, and Mariman (2025), "Generative AI Without Guardrails Can Harm Learning: Evidence From High School Mathematics," *PNAS* (earlier SSRN, 2024, "Generative AI Can Harm Learning").**
  - **DOK 1 - Facts:** RCT with about 1,000 high-school math students. During practice, AI raised grades 48% (standard ChatGPT-style "GPT Base") and 127% (guardrailed "GPT Tutor" giving hints, not answers). With AI removed for the exam, the GPT Base group scored 17% worse than students who never had AI, while the GPT Tutor group's harm was erased. Logs showed Base users copied solutions (a "crutch"); Tutor users asked for help and attempted answers. Students did not perceive the reduction.
  - **DOK 2 - Summary:** The same model helps or harms based entirely on whether it preserves the student's effort. Design, not horsepower, decides.
  - **Link:** https://www.pnas.org/doi/abs/10.1073/pnas.2422633122

**Subcategory 3.2: Effort-preserving tutoring rivals human tutors**

- **VanLehn (2011), "The Relative Effectiveness of Human Tutoring, Intelligent Tutoring Systems, and Other Tutoring Systems," *Educational Psychologist* 46(4), 197-221.**
  - **DOK 1 - Facts:** Human tutoring effect size d = 0.79 (far below the long-assumed 2.0 from Bloom's 1984 "2 sigma problem"); intelligent tutoring systems d = 0.76, nearly matching human tutors and well above answer-based aids (about 0.3). Step-based tutoring reached d = 0.76; finer substep granularity added nothing.
  - **DOK 2 - Summary:** Software that engages students step by step in their own work rivals human tutors; AI's leverage is delivering effort-preserving, step-level feedback at scale.
  - **Link:** https://doi.org/10.1080/00461520.2011.611369

## References

- Bastani, H., Bastani, O., Sungu, A., Ge, H., Kabakci, O., and Mariman, R. (2025). Generative AI without guardrails can harm learning: Evidence from high school mathematics. *PNAS.* (Earlier: *SSRN Electronic Journal*, 2024.) https://www.pnas.org/doi/abs/10.1073/pnas.2422633122
- Bjork, R. A., and Bjork, E. L. (2011). Making things hard on yourself, but in a good way: Creating desirable difficulties to enhance learning. In *Psychology and the Real World* (pp. 56-64). Worth. https://bjorklab.psych.ucla.edu/publications/
- Bloom, B. S. (1984). The 2 sigma problem: The search for methods of group instruction as effective as one-to-one tutoring. *Educational Researcher* 13(6), 4-16.
- Deslauriers, L., McCarty, L. S., Miller, K., Callaghan, K., and Kestin, G. (2019). Measuring actual learning versus feeling of learning in response to being actively engaged in the classroom. *PNAS* 116(39), 19251-19257. https://www.pnas.org/doi/10.1073/pnas.1821936116
- Dunlosky, J., Rawson, K. A., Marsh, E. J., Nathan, M. J., and Willingham, D. T. (2013). Improving students' learning with effective learning techniques. *Psychological Science in the Public Interest* 14(1), 4-58. https://journals.sagepub.com/doi/abs/10.1177/1529100612453266
- Freeman, S., Eddy, S. L., McDonough, M., Smith, M. K., Okoroafor, N., Jordt, H., and Wenderoth, M. P. (2014). Active learning increases student performance in science, engineering, and mathematics. *PNAS* 111(23), 8410-8415. https://www.pnas.org/doi/abs/10.1073/pnas.1319030111
- Hanus, M. D., and Fox, J. (2015). Assessing the effects of gamification in the classroom. *Computers and Education* 80, 152-161. https://www.sciencedirect.com/science/article/abs/pii/S0360131514002000
- Harp, S. F., and Mayer, R. E. (1998). How seductive details do their damage: A theory of cognitive interest in science learning. *Journal of Educational Psychology* 90(3), 414-434. https://doi.org/10.1037/0022-0663.90.3.414
- Koedinger, K. R., Kim, J., Jia, J., McLaughlin, E. A., and Bier, N. L. (2015). Learning is not a spectator sport: Doing is better than watching for learning from a MOOC. *Proceedings of the ACM Conference on Learning @ Scale*, 111-120. https://doi.org/10.1145/2724660.2724681
- Mueller, P. A., and Oppenheimer, D. M. (2014). The pen is mightier than the keyboard: Advantages of longhand over laptop note taking. *Psychological Science* 25(6), 1159-1168. https://journals.sagepub.com/doi/abs/10.1177/0956797614524581
- Roediger, H. L., and Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science* 17(3), 249-255. https://doi.org/10.1111/j.1467-9280.2006.01693.x
- Slamecka, N. J., and Graf, P. (1978). The generation effect: Delineation of a phenomenon. *Journal of Experimental Psychology: Human Learning and Memory* 4(6), 592-604. https://doi.org/10.1037/0278-7393.4.6.592
- Soderstrom, N. C., and Bjork, R. A. (2015). Learning versus performance: An integrative review. *Perspectives on Psychological Science* 10(2), 176-199. https://doi.org/10.1177/1745691615569000
- VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. *Educational Psychologist* 46(4), 197-221. https://doi.org/10.1080/00461520.2011.611369
