import { useMemo } from "react";

interface Verse {
  ref: string;
  text: string;
}

const VERSES: Verse[] = [
  { ref: "Colossians 3:23", text: "Whatever you do, work at it with all your heart, as working for the Lord, not for human masters." },
  { ref: "Galatians 6:9", text: "Let us not become weary in doing good, for at the proper time we will reap a harvest if we do not give up." },
  { ref: "Proverbs 16:3", text: "Commit to the Lord whatever you do, and he will establish your plans." },
  { ref: "1 Corinthians 15:58", text: "Always give yourselves fully to the work of the Lord, because you know that your labor in the Lord is not in vain." },
  { ref: "James 1:12", text: "Blessed is the one who perseveres under trial because, having stood the test, that person will receive the crown of life." },
  { ref: "Proverbs 14:23", text: "All hard work brings a profit, but mere talk leads only to poverty." },
  { ref: "Hebrews 12:11", text: "No discipline seems pleasant at the time, but painful. Later on, however, it produces a harvest of righteousness and peace." },
  { ref: "Psalm 37:5", text: "Commit your way to the Lord; trust in him and he will do this." },
  { ref: "2 Timothy 4:7", text: "I have fought the good fight, I have finished the race, I have kept the faith." },
  { ref: "Philippians 4:13", text: "I can do all this through him who gives me strength." },
  { ref: "Joshua 1:9", text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go." },
  { ref: "Proverbs 21:5", text: "The plans of the diligent lead surely to abundance." },
  { ref: "Ecclesiastes 9:10", text: "Whatever your hand finds to do, do it with all your might." },
  { ref: "Romans 5:3-4", text: "We glory in our sufferings, because we know that suffering produces perseverance; perseverance, character; and character, hope." },
  { ref: "Isaiah 40:31", text: "Those who hope in the Lord will renew their strength. They will soar on wings like eagles." },
  { ref: "Proverbs 3:5-6", text: "Trust in the Lord with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight." },
  { ref: "Psalm 90:17", text: "May the favor of the Lord our God rest on us; establish the work of our hands." },
  { ref: "1 Peter 5:10", text: "After you have suffered a little while, he will restore you and make you strong, firm and steadfast." },
  { ref: "Matthew 25:21", text: "Well done, good and faithful servant! You have been faithful with a few things; I will put you in charge of many things." },
  { ref: "Micah 6:8", text: "Act justly and to love mercy and to walk humbly with your God." },
  { ref: "Psalm 46:1", text: "God is our refuge and strength, an ever-present help in trouble." },
  { ref: "2 Chronicles 15:7", text: "Be strong and do not give up, for your work will be rewarded." },
  { ref: "Luke 16:10", text: "Whoever can be trusted with very little can also be trusted with much." },
  { ref: "Ephesians 6:10", text: "Be strong in the Lord and in his mighty power." },
  { ref: "Romans 12:11", text: "Never be lacking in zeal, but keep your spiritual fervor, serving the Lord." },
  { ref: "Proverbs 12:24", text: "Diligent hands will rule." },
  { ref: "Hebrews 10:23", text: "Let us hold unswervingly to the hope we profess, for he who promised is faithful." },
  { ref: "Psalm 18:32", text: "It is God who arms me with strength and keeps my way secure." },
  { ref: "1 Corinthians 9:24", text: "Run in such a way as to get the prize." },
  { ref: "Isaiah 41:10", text: "Do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you." },
  { ref: "Psalm 20:4", text: "May he give you the desire of your heart and make all your plans succeed." },
];

const DailyVerse = () => {
  const verse = useMemo(() => {
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
    );
    return VERSES[dayOfYear % VERSES.length];
  }, []);

  return (
    <div className="text-center max-w-2xl mx-auto">
      <p className="text-xl md:text-2xl italic text-white/50 leading-relaxed">
        "{verse.text}"
      </p>
      <p className="text-sm text-white/30 mt-2">— {verse.ref}</p>
    </div>
  );
};

export default DailyVerse;
