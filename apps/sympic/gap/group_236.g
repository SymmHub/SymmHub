Read("color_builder_json.g");


F := FreeGroup("a","b","c","d");;
a := F.1; 
b := F.2;
c := F.3; 
d := F.4; 

G := F/[a^2, b^3, a*c, b*d, (a*d)^6];

s := ColorBuilderJSON(G, "2 3 6", 15, 0);

Print(s);
PrintTo("sub/sub_236.json", s);




