const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

const enrichments = [
  {
    day_number: 1,
    description: "The definitive West Coast DIPA. Floods the senses with pine resin and grapefruit pith before a long, clean bitter finish that refuses to quit. Deceptively drinkable at 8% — it earns that reputation.",
    brewery_fact: "Russian River opened in Sonoma County in 1997 and is run by husband-and-wife team Vinnie and Natalie Cilurzo — Vinnie is widely credited with popularizing double IPAs in the American craft scene.",
    beer_fact: "Pliny the Elder is named after the Roman naturalist who wrote about hops in 77 AD. It's been rated the best beer in America so many times that Russian River had to ask people to stop lining up overnight."
  },
  {
    day_number: 2,
    description: "Vermont's most coveted secret. Unfiltered and hazy, it pours a dense cloud of tropical citrus — mango, pineapple, a hint of dank pine — with a creamy body that somehow finishes clean. Drink it straight from the can, as instructed.",
    brewery_fact: "The Alchemist is a tiny one-barrel operation in Stowe, Vermont, run by John and Jen Kimmich. At peak demand, people drove hours and waited in lines longer than most theme parks just to buy a four-pack.",
    beer_fact: "Heady Topper kicked off the New England IPA revolution. It was originally brewed in such small batches that it rarely left the state — which only amplified the legend. RateBeer once named it the best beer in the world."
  },
  {
    day_number: 3,
    description: "Thick as a storm cloud and twice as ominous. Dark fruit, bittersweet chocolate, roasted coffee, and a molasses depth that coats every surface. This is not a casual beer — approach with reverence.",
    brewery_fact: "Surly Brewing was founded in Brooklyn Center, Minnesota by Omar Ansari in 2005. Surly's success was so overwhelming that Minnesota literally changed its state law to allow brewery taprooms — now known as the 'Surly Bill.'",
    beer_fact: "Darkness is released once a year on 'Darkness Day' — a festival so popular it sells out in minutes. Variants include Darkness aged in bourbon, rum, and brandy barrels, each treated as a separate trophy."
  },
  {
    day_number: 4,
    description: "Built almost entirely on Citra hops, Zombie Dust is a masterclass in restraint. The aroma hits first — fresh tropical fruit, orange zest, stone fruit — followed by a light, biscuity malt backbone that keeps it grounded. Crushable despite its legend.",
    brewery_fact: "3 Floyds is named after founders Nick, Simon, and their father Michael Floyd. Based in Munster, Indiana, their motto is 'Not Normal' — which accurately describes both their beer and their annual Darkness Day event, which regularly draws thousands.",
    beer_fact: "Zombie Dust is named after the Misfits lyric. It's been called the best pale ale in America by multiple publications and routinely sells out within hours of hitting shelves — often inspiring informal secondary markets."
  },
  {
    day_number: 5,
    description: "One year in a freshly emptied bourbon barrel transforms this imperial stout into something profoundly different. Vanilla bean, coconut, dark chocolate, and a gentle bourbon heat that builds slowly. You don't drink this; you experience it.",
    brewery_fact: "Goose Island was founded in Chicago in 1988 and pioneered the barrel-aging program that changed American craft beer. They were acquired by AB InBev in 2011 — a sale that divided the craft community but didn't diminish the quality of their flagship barrel program.",
    beer_fact: "Bourbon County Stout debuted in 1992 as one of the first commercially produced barrel-aged beers in the US. Each year's vintage is subtly different based on the specific barrels used — collectors buy multiples to compare vintages side by side."
  },
  {
    day_number: 6,
    description: "A confident, boldly hopped IPA that earns its name. Chinook brings the pine, Citra brings the citrus, and Amarillo ties it together with a floral lift. Bright up front, bone-dry at the finish — a Pacific Northwest IPA done exactly right.",
    brewery_fact: "Elysian Brewing was founded in Seattle in 1996 by Dick Cantwell, Joe Bisacca, and David Buhler. They've long been known for experimental and seasonal releases, including a legendary pumpkin festival with dozens of variants each fall.",
    beer_fact: "Space Dust is Elysian's flagship and one of the best-selling IPAs in the Pacific Northwest. It was famously featured as the hardcoded preview beer in a web app called Hallowed Hop Society — selected purely for its cosmic credentials."
  },
  {
    day_number: 7,
    description: "Named for a fish with venomous spines, Sculpin rewards patience. The aroma is almost fruit-forward enough to be a juice — apricot, peach, mango, and fresh lemon — before the West Coast bitterness lands clean on the back palate. A gateway IPA that never gets old.",
    brewery_fact: "Ballast Point was founded in San Diego in 1996 and grew from a homebrew shop into one of the most decorated American craft breweries before selling to Constellation Brands in 2015 for $1 billion — the largest craft beer acquisition in history at the time.",
    beer_fact: "Sculpin IPA was the first American beer to win the World Beer Cup gold medal twice in the same category. The 'Grapefruit Sculpin' variant — brewed with real grapefruit peel — became one of the best-selling flavored IPAs in the country."
  },
  {
    day_number: 8,
    description: "Cave-aged in bourbon barrels for an entire year — the patience required to make it is evident in every sip. Coffee and chocolate dominate upfront, with bourbon warmth, smoke, and a hint of vanilla emerging as it warms. The morning and the evening in one glass.",
    brewery_fact: "Founders Brewing in Grand Rapids, Michigan nearly went bankrupt in 2000 before pivoting to high-gravity, full-flavored beers that appealed to serious drinkers. That pivot, and KBS specifically, rescued the brewery and made it a Midwest institution.",
    beer_fact: "KBS stands for Kentucky Breakfast Stout — originally so named because it tasted like breakfast. It's aged in bourbon barrels inside actual caves in Michigan. Annual release day creates lines that begin forming the night before."
  },
  {
    day_number: 9,
    description: "Proof that wheat beers belong in the craft conversation. Light-bodied and hazy with a soft grain character, then Amarillo hops arrive bringing grapefruit and tropical fruit where you'd least expect them. Endlessly refreshing in any season.",
    brewery_fact: "3 Floyds' Gumballhead is named after a comic book character created by Tom Neely, continuing the brewery's tradition of collaborating with artists and musicians. The can artwork changes seasonally and has become collectible in its own right.",
    beer_fact: "Gumballhead is brewed year-round and is considered one of the definitive examples of the American wheat ale style — a genre that rarely gets taken seriously. At under 5.6%, it's also one of the most sessionable beers in the 3 Floyds lineup."
  },
  {
    day_number: 10,
    description: "Maine Beer Company keeps it elemental and it pays off. Citrus pith, fresh pine, a grassy dankness that's more forest than backyard — then a bitterness that lingers without overstaying its welcome. This is what an IPA is supposed to be.",
    brewery_fact: "Maine Beer Company was founded in Portland, Maine in 2009 with a commitment to environmental responsibility — they donate 1% of sales to environmental causes and use Maine's own water supply, which is among the purest in the country.",
    beer_fact: "Lunch IPA was initially only sold in Maine, creating a cult following among travelers who'd ferry bottles home. Maine Beer Company has since expanded distribution but still limits quantities — and Lunch remains the standard-bearer for East Coast IPAs."
  },
  {
    day_number: 11,
    description: "All Citra, no apologies. Pale straw, hazy, and aggressively tropical — pineapple, mango, passion fruit — with zero of the harsh bitterness that ruins lesser DIPAs. At 7.8% it drinks like half that. A dangerous and delightful exercise in single-hop restraint.",
    brewery_fact: "Toppling Goliath is in Decorah, Iowa — a town of 8,000 people — and yet has produced multiple beers that placed in the top five on every major craft beer ranking. Clark Lewey founded it in 2009 after years of homebrewing obsession.",
    beer_fact: "King Sue uses only Citra hops from first wort addition through dry hop, making it one of the purest single-variety showcases in American brewing. It routinely sells out within minutes of online pre-sale announcements."
  },
  {
    day_number: 12,
    description: "Bell's pours in six hop varieties and honey at the boil, then lets the magic happen. The result is aggressive but never brutal — citrus and pine push forward, honey rounds out the middle, and the finish is warm and lingering. Annual release. Limited. Hunt it down.",
    brewery_fact: "Bell's Brewery was founded by Larry Bell in Kalamazoo, Michigan in 1985, making it one of the oldest craft breweries in the Midwest. Larry started with a 15-gallon soup kettle. Today Bell's produces over 300,000 barrels a year.",
    beer_fact: "Hopslam is released every January and disappears in weeks. It typically tops 10% ABV, though the exact percentage varies slightly by vintage. Bars that carry it routinely impose purchase limits — and still sell out before noon on release day."
  },
  {
    day_number: 13,
    description: "Old Rasputin doesn't need your approval. Roasted barley, bittersweet chocolate, espresso — all bearing down like a czar's gaze. The warmth builds slowly, the finish lingers for what feels like minutes. Dark and unapologetic from start to end.",
    brewery_fact: "North Coast Brewing was founded in Fort Bragg, California in 1988 in a former Presbyterian church and mortuary. The building's history may explain the brewery's comfort with darkness — their portfolio skews heavily toward the heavy end of the spectrum.",
    beer_fact: "Old Rasputin is named after the infamous Russian mystic Grigori Rasputin, who reportedly survived multiple assassination attempts before finally dying. The beer's label features his haunted portrait and a verse from an old folk song about his death."
  },
  {
    day_number: 14,
    description: "100% Centennial hops. Floral, citrusy, and balanced with a precision that most breweries spend careers chasing. It's not trying to shock you — it's trying to be perfect. Michigan has quietly built its case with this beer for 30-plus years.",
    brewery_fact: "Bell's Brewery introduced Two Hearted Ale in 1997, naming it after the Two-Hearted River in Michigan's Upper Peninsula — made famous by Ernest Hemingway. The brewery sits in Kalamazoo and has become synonymous with Midwest craft beer quality.",
    beer_fact: "Two Hearted Ale won the 2018 Great American Beer Festival gold medal in the American IPA category and has been voted America's best beer by the American Homebrewers Association multiple times. It remains one of the top-selling craft IPAs in the Midwest."
  },
  {
    day_number: 15,
    description: "You know what this is. Clean, crisp, rice-adjunct lager with exactly the inoffensiveness it promises. No depth. No surprises. Just carbonation, a light grain note, and a finish that exits before you register it. The palate cleanser the Society demands between bolder entries.",
    brewery_fact: "Anheuser-Busch has been brewing Budweiser since 1876, making it one of the oldest continuous commercial beer brands in America (discounting Prohibition). The company was acquired by Belgian giant InBev in 2008 in a $52 billion deal.",
    beer_fact: "Budweiser famously ran a Super Bowl ad in 2015 mocking craft beer drinkers and their 'pumpkin peach ales' — which backfired spectacularly when it aired during the same week Budweiser filed trademark opposition against a small Bend, Oregon brewery. The Society includes it as a lesson."
  },
  {
    day_number: 16,
    description: "Russian River takes a dark sour ale, ages it in Cabernet Sauvignon barrels with black currants, and produces something that belongs in a wine cellar as much as a beer fridge. Tart and funky with a vinous depth that rewards slow sipping. A legitimate conversation piece.",
    brewery_fact: "Russian River's sour program under Vinnie Cilurzo is considered one of the most technically sophisticated in the United States. Consecration, Temptation, and Supplication form a trilogy of wine-barrel sours that take years to produce properly.",
    beer_fact: "Consecration is aged for approximately 10 months in Cabernet Sauvignon barrels sourced from Napa Valley wineries. The black currants added during fermentation create a natural tension between fruit sweetness and acidity that makes it unlike any other American sour."
  },
  {
    day_number: 17,
    description: "Every year Goose Island selects a handful of barrels from their already-limited BCS program and sets them aside. Rare is the result — single-barrel or small-lot blends with a complexity that makes the regular vintage look like a rough draft. Pure indulgence.",
    brewery_fact: "The Rare Bourbon County Stout program began in 2010 as a way to showcase exceptional individual barrels that were too good to blend away. Each year's Rare is different — some are single-barrel releases, others are small blends aged in unusual cooperage.",
    beer_fact: "Rare BCS releases have included variants aged in Elijah Craig barrels, Buffalo Trace barrels, and even Pappy Van Winkle cooperage. A 2010 vintage Rare was auctioned for over $400 — making it one of the most valuable mass-market beers ever sold."
  },
  {
    day_number: 18,
    description: "400 pounds of peach per batch is not a suggestion — it's a commitment. The stone fruit is lush, real, and present in every sip alongside a dry-hopped backbone that keeps it honest. This is what fruit IPAs should aspire to but rarely achieve.",
    brewery_fact: "Dogfish Head was founded in 1995 in Milton, Delaware by Sam Calagione, who built the brewery from a converted gas station. Calagione pioneered the 'extreme beer' movement with off-centered ales using unusual ingredients from ancient recipes to culinary inspiration.",
    beer_fact: "Tree Shaker uses local Delaware peaches and is part of Dogfish Head's 'Flesh and Blood' series of fruit-forward IPAs. The peach concentration is so high that the beer was initially categorized as a fruit wine by federal regulators before Dogfish Head successfully argued for beer classification."
  },
  {
    day_number: 19,
    description: "Citra and Mosaic in equal measure — the two most celebrated hops in craft beer — result in a beer that's tropical, dank, and just hazy enough. At 7% it's the Alchemist's concession to sessions. Still better than most breweries' best effort.",
    brewery_fact: "The Alchemist operates with an almost monastic discipline — no social media hype, limited distribution, and production decisions made entirely on quality grounds. When they opened their Stowe brewery in 2016, they designed the taproom to feel like a quiet pilgrimage destination.",
    beer_fact: "Focal Banger was created as a response to demand for a more approachable counterpart to Heady Topper. While Heady stays at 8%, Focal comes in at 7% and uses a softer water profile to create a creamier mouthfeel — proving The Alchemist can dial it in at any range."
  },
  {
    day_number: 20,
    description: "Released for two weeks a year. Lines form before dawn. Bars that receive allocation announce it like a civic event. And yet — somehow — it justifies all of it. Triple IPA depth with hop complexity that reveals new layers with every sip. You have reached the summit.",
    brewery_fact: "Russian River releases Pliny the Younger each February for exactly two weeks. In 2016, a study by UC Davis estimated that Younger's release generates over $1 million in economic activity for the Santa Rosa area — from hotel bookings, restaurant visits, and beer tourism.",
    beer_fact: "Pliny the Younger is named after the Roman author and lawyer who was a nephew of Pliny the Elder (Day 1). The Younger reportedly witnessed the eruption of Mount Vesuvius in 79 AD and survived to write about it — a fitting legacy for a beer that survives its own hype."
  },
  {
    day_number: 21,
    description: "Toppling Goliath's heaviest artillery. At 15%, this is less beer and more ceremony. Chocolate syrup, dark cherry, leather, a faint smoky warmth, and a body that borders on chewy. Sip one ounce at a time if you know what's good for you.",
    brewery_fact: "Toppling Goliath's Decorah, Iowa location is a point of pride — they've turned what should be a distribution disadvantage into mystique. Collectors make pilgrimages to their taproom specifically to buy bottles that rarely leave the state.",
    beer_fact: "Permanent Funeral is named after a lyric from a Darkthrone song — a Norwegian black metal band. It's one of the highest-rated imperial stouts on Untappd and BeerAdvocate, despite being nearly impossible to find outside of Iowa and a handful of specialty shops."
  },
  {
    day_number: 22,
    description: "The beer that built Surly Brewing. Furious opens with aggressive hop bitterness — piney, citrusy, uncompromising — then a caramel malt backbone arrives to keep it from tipping into chaos. Balanced in the way a controlled detonation is balanced.",
    brewery_fact: "Surly Brewing changed Minnesota law. Before 2011, Minnesota breweries couldn't have taprooms on-site. After Surly's advocacy, the 'Surly Bill' passed, opening the door for hundreds of Minnesota breweries to follow. Surly's Destination Brewery in Minneapolis opened in 2014.",
    beer_fact: "Furious was originally brewed in batches so small that Surly could only serve it at select Twin Cities bars. When they scaled up, demand still outpaced supply. It's named after a state of mind — which Surly founder Omar Ansari described as the mindset needed to start a brewery in Minnesota."
  },
  {
    day_number: 23,
    description: "October in a glass and proud of it. Real pumpkin, cinnamon, nutmeg, allspice, and a vanilla cream sweetness that makes this a dessert in disguise. At 8.6%, it has the weight to back up the spectacle. Reserved for those unafraid of big flavors.",
    brewery_fact: "Southern Tier Brewing was founded in 2002 in Lakewood, New York, near the Pennsylvania border. They specialize in big, bold, season-forward beers — Pumking is their fall flagship and the beer that put them on the national map.",
    beer_fact: "Pumking was one of the first widely distributed imperial pumpkin ales and helped establish the fall seasonal beer category as a cultural phenomenon. It's consistently rated among the top three pumpkin beers in the country and appears on shelves earlier each year — the subject of heated debate."
  },
  {
    day_number: 24,
    description: "Scratch Brewing works with foraged and locally sourced ingredients — and Rye of the Tiger shows why that philosophy works. Spicy rye malt bends against aggressive dry hopping, creating something earthy, peppery, bracingly bitter, and entirely its own. Not for the timid.",
    brewery_fact: "Scratch Brewing is a farm brewery in Ava, Illinois, population 660. They forage ingredients from their surrounding land — bark, mushrooms, herbs, edible flowers — and incorporate them into beers that reflect their specific geography more than any other American brewery.",
    beer_fact: "Rye of the Tiger's name riffs on the Eye of the Tiger and winks at the intensity of the rye character. Unlike many rye IPAs that downplay the grain, Scratch leans in — the rye makes up a significant portion of the grain bill, creating a spice level that redefines the style."
  },
  {
    day_number: 25,
    description: "Pipeworks named it honestly. Wall-to-wall Citra hops produce a flood of grapefruit, passion fruit, and melon that just keeps coming. It's big, bold, and makes no effort to hide what it is. Exactly the beer its name promises.",
    brewery_fact: "Pipeworks Brewing is a Chicago-based craft brewery founded in 2012 that operates with a rotating, experimental philosophy — releasing dozens of small-batch, often one-off beers per year. They're known for their playful names and willingness to push style boundaries.",
    beer_fact: "Citra Ass Down was originally brewed as a one-off experimental batch that proved so popular it became a permanent fixture. It's become one of Pipeworks' most recognized beers and helped cement the Chicago craft scene's reputation for bold, unapologetic hop-forward brewing."
  },
  {
    day_number: 26,
    description: "Deschutes brews The Abyss with licorice root and cherry bark — ingredients that sound alarming and taste transcendent. Some of each batch ages in bourbon barrels; some in Oregon Pinot Noir. The result is dense, dark, and layered in ways most stouts only attempt.",
    brewery_fact: "Deschutes Brewery was founded in Bend, Oregon in 1988 and is one of the largest craft breweries in the Pacific Northwest. They were early pioneers in the barrel-aging movement, using local wine barrels from the Willamette Valley alongside traditional bourbon casks.",
    beer_fact: "The Abyss is released once annually in the fall and comes in a corked and caged 22oz bottle. Deschutes ages a portion in both bourbon and Oregon Pinot Noir barrels and then blends them — a practice more common in winemaking than brewing. It improves significantly with cellaring."
  },
  {
    day_number: 27,
    description: "Cigar City applies Florida sunshine to a traditionally West Coast format. Big citrus and tropical fruit dominate the nose, pine resin takes over the middle, and the finish is assertive without being punishing. Warm-weather aggression in the best possible way.",
    brewery_fact: "Cigar City Brewing was founded in Tampa, Florida in 2009 by Wayne Wambles and Joey Redner. Named for Tampa's historic cigar industry, they've grown into one of the most decorated craft breweries in the Southeast — and were acquired by Oskar Blues parent company CANarchy in 2017.",
    beer_fact: "Zombie Apocalypse pairs thematically with Day 4's Zombie Dust — a nod the Society placed intentionally. Cigar City's zombie-themed branding predates the craft beer trend toward horror imagery, and the beer was one of their first nationally distributed releases."
  },
  {
    day_number: 28,
    description: "An imperial amber ale that refuses to be pigeonholed. The Nugget, Apollo, and Warrior hops bring a resinous, almost piney intensity that cuts through a rich caramel malt foundation. It pours copper and drinks big. The East Coast's answer to West Coast hop aggression.",
    brewery_fact: "Tröegs Independent Brewing was founded by brothers Chris and John Trogner in 1997 in Harrisburg, Pennsylvania, then relocated to Hershey in 2011. Independent is in their name because they mean it — they've turned down acquisition offers repeatedly.",
    beer_fact: "Nugget Nectar is released in January and February and is often called 'Hop-Nectar Season' by its devoted following. The beer is brewed with over 130 hop pellets per barrel, making it one of the most intensely dry-hopped American ambers ever produced."
  },
  {
    day_number: 29,
    description: "Whole cone hops — not pellets, not extract — distinguish Ghost in the Machine from anything brewed at industrial scale. The result has a green, almost raw hop character alongside tropical fruit and orange zest, with a finish that's bitter but never harsh.",
    brewery_fact: "Port Brewing Company operates out of San Marcos, California, alongside The Lost Abbey, sharing a facility with brewer Tomme Arthur — one of the most respected sour and barrel-aged brewers in the country. Port handles the hoppy, accessible side; Lost Abbey handles the wild.",
    beer_fact: "Ghost in the Machine's name references Koestler's philosophy text and hints at the beer's elusive nature — it's hard to find outside California. Whole cone hops are used in only a small fraction of commercial beers because they're difficult to handle at scale and require specialized equipment."
  },
  {
    day_number: 30,
    description: "The standard Darkness made gentle — but only slightly. Bourbon-soaked vanilla beans soften the roast and chocolate, adding cream and warmth where the base beer has edge. Still an imperial stout that demands respect. Just more willing to meet you halfway.",
    brewery_fact: "Surly releases the Darkness Vanilla variant in extremely limited quantities alongside standard Darkness on Darkness Day. The variant has developed its own waiting list and secondary market — with some collectors refusing to open it, treating it as pure cellaring material.",
    beer_fact: "The vanilla used in Darkness Vanilla is sourced from beans that have been soaked in bourbon before being added to the beer during conditioning — not vanilla extract. The distinction matters; real bean vanilla produces a subtler, more complex sweetness that blends with the oak-forward stout character."
  },
  {
    day_number: 31,
    description: "Made by Cistercian Trappist monks in the West Flanders region of Belgium, Westvleteren 12 is not distributed, not marketed, and not sold by the brewery except in limited quantities directly at the abbey gate. Dark fruit, caramel, fig, a touch of warming spice, and complexity that rewards every sip. This is how it ends.",
    brewery_fact: "The monks of Saint Sixtus Abbey in Vleteren, Belgium have been brewing since 1838. They produce only as much beer as needed to fund the monastery's operations — not a drop more. The abbey has no marketing department, no distribution network, and no desire to scale.",
    beer_fact: "To purchase Westvleteren 12 directly from the abbey, you must call a dedicated phone line, provide your license plate number, and agree to not resell the beer. Despite this, it regularly appears on secondary markets at significant markup. It has been rated the best beer in the world more times than any other beer in history."
  }
];

async function run() {
  let success = 0;
  for (const beer of enrichments) {
    const { error } = await sb.from('beers')
      .update({ description: beer.description, brewery_fact: beer.brewery_fact, beer_fact: beer.beer_fact })
      .eq('day_number', beer.day_number);
    if (error) {
      console.error('Day', beer.day_number, 'ERROR:', error.message);
    } else {
      console.log('Day', beer.day_number, 'OK');
      success++;
    }
  }
  console.log(success + '/31 updated');
}
run();
