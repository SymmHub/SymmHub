ColorBuilderTrianleGroupJSON := function(n, m, l, maxIndex)

  local F, a, b, c, G, name;
  F := FreeGroup("a","b","c");;
  a := F.1;; 
  b := F.2;; 
  c := F.3;
  G := F/[a^2, b^2, c^2, (a*c)^n,(a*b)^m,(b*c)^l];
  name := Concatenation(String(n), " ", String(m), " ", String(l));

  return ColorBuilderJSON(G, name, maxIndex, 0);

end;

#
# group is defined as angles at the edges connecting numbered vertices
# better would be to use dihedral angles between numbered faces 
#
CoxeterTetrahedronGroupEdgesJSON := function(e12, e13, e14, e23, e24, e34, maxIndex)

  local F, a, b, c, d, f1, f2, f3, f4, G, name;
  F := FreeGroup("a","b","c","d");;

  a := F.1;; b:= F.2;; 
  c := F.3;; d:= F.4;; 
  f1 := F.1;; f2:= F.2;; 
  f3 := F.3;; f4:= F.4;; 

  G := F/[f1^2, f2^2, f3^2, f4^2, (f3*f4)^e12,(f2*f4)^e13,(f2*f3)^e14, (f1*f4)^e23,(f1*f3)^e24, (f1*f2)^e34];
  name := Concatenation(String(e12), " ", String(e13), " ", String(e14), " ", String(e23), " ", String(e24), " ", String(e34));

  return ColorBuilderJSON(G, name, maxIndex, 0);
  

end;

# 
# group is defined via given dihedral angles between numbered faces (correspods to Coxeter diagrams) 
#
CoxeterTetrahedronGroupFacesJSON := function(a12, a13, a14, a23, a24, a34, maxIndex)

  local F, a, b, c, d, f1, f2, f3, f4, G, name;
  F := FreeGroup("a","b","c","d");;

  a := F.1;; b:= F.2;; 
  c := F.3;; d:= F.4;; 
  f1 := F.1;; f2:= F.2;; 
  f3 := F.3;; f4:= F.4;; 

  G := F/[f1^2, f2^2, f3^2, f4^2,  (f1*f2)^a12, (f1*f3)^a13,  (f1*f4)^a14, (f2*f3)^a23,(f2*f4)^a24,(f3*f4)^a34];
  name := Concatenation(String(a12), " ", String(a13), " ", String(a14), " ", String(a23), " ", String(a24), " ", String(a34));

  return ColorBuilderJSON(G, name, maxIndex, 0);
  

end;
