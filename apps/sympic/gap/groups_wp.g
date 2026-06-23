# wp_groups.g
# Finitely presented representations of the 17 wallpaper groups
# using custom generator and relator definitions.

# --- Individual group constructor prototypes ---

make_wp_o := function()
  local F, a, b, c, d;
  F := FreeGroup("a", "b", "c", "d");;
  a := F.1;; b := F.2;; c := F.3;; d := F.4;;
  # Prototype relators for "o" (p1)
  return F / [ a*b, c*d, a*c*b*d ];
end;

make_wp_2222 := function()
  local F, a, b, c, d;
  F := FreeGroup("a", "b", "c", "d");;
  a := F.1;; b := F.2;; c := F.3;; d := F.4;;
  # Prototype relators for "2222" (p2)
  return F / [ a^2, b^2, c*d, (c*a)^2, (c*b)^2];
end;

make_wp_ss := function()
  local F, a, b, c, d;
  F := FreeGroup("a", "b", "c", "d");;
  a := F.1;; b := F.2;; c := F.3;; d := F.4;;
  # Prototype relators for "**" (pm)
  return F / [ a^2, b^2, c*d, a*c*a*d, a*d*a*c, b*c*b*d, b*d*b*c ];
end;

make_wp_xx := function()
  local F, a, b, c, d;
  F := FreeGroup("a", "b", "c", "d");;
  a := F.1;; b := F.2;; c := F.3;; d := F.4;;
  # Prototype relators for "xx" (pg)
  return F / [ a*b, c*d, a*d*b*d,a*c*b*c, b*d*a*d, b*c*a*c ];
end;

make_wp_sx := function()
  local F, a, b, c, d;
  F := FreeGroup("a", "b", "c", "d");;
  a := F.1;; b := F.2;; c := F.3;; d := F.4;;
  # Prototype relators for "*x" / "X*" (cm)
  return F / [ c^2, d^2, a*b, a*c*b*d, b*c*a*d];
end;

make_wp_s2222 := function()
  local F, a, b, c, d;
  F := FreeGroup("a", "b", "c", "d");;
  a := F.1;; b := F.2;; c := F.3;; d := F.4;;
  # Prototype relators for "*2222" (pmm)
  return F / [ a^2, b^2, c^2, d^2, (a*c)^2, (c*b)^2,(b*d)^2, (d*a)^2 ];
end;

make_wp_22s := function()
  local F, a, b, c, d;
  F := FreeGroup("a", "b", "c", "d");;
  a := F.1;; b := F.2;; c := F.3;; d := F.4;;
  # Prototype relators for "22*" (pmg)
  return F / [ a^2, b^2, c^2, d^2, (a*c*a*d), (b*c*b*d) ];
end;

make_wp_22x := function()
  local F, a, b, c, d;
  F := FreeGroup("a", "b", "c", "d");;
  a := F.1;; b := F.2;; c := F.3;; d := F.4;;
  # Prototype relators for "22x" / "22X" (pgg)
  return F / [ a*b, c*d, (b*c)^2, (b*d)^2, (a*c)^2, (a*d)^2];
end;

make_wp_2s22 := function()
  local F, a, b, c, d;
  F := FreeGroup("a", "b", "c", "d");;
  a := F.1;; b := F.2;; c := F.3;; d := F.4;;
  # Prototype relators for "2*22" (cmm)
  return F / [ a^2, b^2, c^2, d^2, (a*c)^2, (a*d)^2, (b*c*b*d), (b*d*b*c) ];
end;

make_wp_442 := function()
  local F, a, b, c, d;
  F := FreeGroup("a", "b", "c");;
  a := F.1;; b := F.2;; c := F.3;;
  # Prototype relators for "442" (p4)
  return F / [ a^2, c*b, b^4, (a*b)^4];
end;

make_wp_s442 := function()
  local F, a, b, c;
  F := FreeGroup("a", "b", "c");;
  a := F.1;; b := F.2;; c := F.3;;
  # Prototype relators for "*442" (p4m)
  return F / [ a^2, b^2, c^2,(a*b)^2, (a*c)^4, (b*c)^4 ];
end;

make_wp_4s2 := function()
  local F, a, b, c, d;
  F := FreeGroup("a", "b", "c");;
  a := F.1;; b := F.2;; c := F.3;;
  # Prototype relators for "4*2" (p4g)
  return F / [ a^2, b^4, b*c,(c*a*b*a)^2 ];
end;

make_wp_333 := function()
  local F, a, b, c, d;
  F := FreeGroup("a", "b", "c", "d");;
  a := F.1;; b := F.2;; c := F.3;; d := F.4;;
  # Prototype relators for "333" (p3)
  return F / [ a^3, b^3, a*c, b*d, (a*d)^3 ];
end;

make_wp_s333 := function()
  local F, a, b, c;
  F := FreeGroup("a", "b", "c");;
  a := F.1;; b := F.2;; c := F.3;;
  # Prototype relators for "*333" (p3m1)
  return F / [ a^2, b^2, c^2, (a*b)^3, (b*c)^3, (c*a)^3 ];
end;

make_wp_3s3 := function()
  local F, a, b, c;
  F := FreeGroup("a", "b", "c");;
  a := F.1;; b := F.2;; c := F.3;; 
  # Prototype relators for "3*3" (p31m) 
  # WRONG 
  return F / [ a^2, b^3, b*c,(c*a*b*a)^3 ];
end;

make_wp_632 := function()
  local F, a, b, c;
  F := FreeGroup("a", "b", "c");;
  a := F.1;; b := F.2;; c := F.3;; 
  # Prototype relators for "632" (p6)
  return F / [ a^2, b^3, (a*b)^6, b*c];
end;

make_wp_s632 := function()
  local F, a, b, c;
  F := FreeGroup("a", "b", "c");;
  a := F.1;; b := F.2;; c := F.3;;
  # Prototype relators for "*632" (p6m)
  return F / [ a^2, b^2, c^2, (a*b)^2, (b*c)^3, (c*a)^6];
end;


# --- Router function ---

# Returns the finitely presented (FP) group representation of the wallpaper group
# by calling the corresponding custom make_wp_... function.
get_wp_group := function(orbifold)
  local name;
  name := orbifold;
  
  if name = "o" or name = "O" then
    return make_wp_o();
  elif name = "2222" then
    return make_wp_2222();
  elif name = "**" then
    return make_wp_ss();
  elif name = "xx" or name = "XX" then
    return make_wp_xx();
  elif name = "*x" or name = "x*" or name = "X*" or name = "*X" then
    return make_wp_sx();
  elif name = "*2222" then
    return make_wp_s2222();
  elif name = "22*" then
    return make_wp_22s();
  elif name = "22x" or name = "22X" then
    return make_wp_22x();
  elif name = "2*22" then
    return make_wp_2s22();
  elif name = "442" then
    return make_wp_442();
  elif name = "*442" then
    return make_wp_s442();
  elif name = "4*2" then
    return make_wp_4s2();
  elif name = "333" then
    return make_wp_333();
  elif name = "*333" then
    return make_wp_s333();
  elif name = "3*3" then
    return make_wp_3s3();
  elif name = "632" then
    return make_wp_632();
  elif name = "*632" then
    return make_wp_s632();
  else
    return fail;
  fi;
end;
