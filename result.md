Bhai prompt ke hisaab se master demo ko aur integrate/polish kar diya:

Updated: ui-ux demo/demo/master_app.tsx

Improvements:

- Featured Bermuda Cup ab direct payment nahi karta; same Quick Join bottom sheet kholta hai.

- Confirm ke baad hi wallet balance deduct hota hai.

- Featured match transaction ledger me add hota hai.

- Profile me login provider aur identifier shared user state se sync hota hai.

- BGMI, COD Mobile aur Valorant sab “Coming Soon” toast dikhate hain.

- Theme, wallet, joined matches aur sign-out flow connected hain.

Checks passed:

- esbuild JSX bundle

- Strict TypeScript check

- git diff --check