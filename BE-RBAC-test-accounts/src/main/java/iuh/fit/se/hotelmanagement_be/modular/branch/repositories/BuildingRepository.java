package iuh.fit.se.hotelmanagement_be.modular.branch.repositories;

import iuh.fit.se.hotelmanagement_be.modular.branch.entities.Building;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface  BuildingRepository extends JpaRepository<Building, String> {
    List<Building> findByHotelId(Long hotelId);
    Optional<Building> findByHotelIdAndName(Long hotelId, String name);
}
